/**
 * Task Management Functions MCP Server
 * 
 * Implements task management functions for multi-agent Roo Code systems:
 * - new_task - Creates subtasks with appropriate context
 * - rate_limit_command_exec - Throttles command execution frequency
 * - extract_mode_assumptions - Pulls contextual information from agents
 * - annotate_mcp_interactions - Documents tool usage patterns
 * 
 * Uses stdio transport for local deployment, following JSON-RPC 2.0 protocol.
 */

import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';

// Type definitions
interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: any;
  id: string | number;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number;
}

interface Task {
  id: string;
  parentTaskId?: string; 
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  createdBy: string;
  assignedTo: string;
  targetMode: string;
  context: {
    files?: string[];
    variables?: Record<string, any>;
    dependencies?: string[];
    assumptions?: Record<string, any>;
    previousResults?: any;
  };
  metadata: Record<string, any>;
  tags: string[];
}

interface RateLimitRule {
  id: string;
  agentId: string;
  commandPattern: string; // Regex pattern to match commands
  maxExecutions: number;
  timeWindowMs: number; // Time window in milliseconds
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

interface CommandExecution {
  id: string;
  agentId: string;
  command: string;
  executedAt: string;
  taskId?: string;
  status: 'executed' | 'rate_limited' | 'failed';
  metadata?: Record<string, any>;
}

interface ModeAssumption {
  id: string;
  modeSlug: string;
  agentId: string;
  taskId?: string;
  timestamp: string;
  category: string;
  assumption: any;
  confidence: number; // 0.0 to 1.0
  source: 'explicit' | 'inferred' | 'default';
  context?: string;
}

interface MCPInteraction {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  mcpServer: string;
  method: string;
  parameters: any;
  result?: any;
  duration: number; // In milliseconds
  status: 'success' | 'error' | 'timeout';
  pattern?: string;
  tags: string[];
}

interface TaskStats {
  totalTasks: number;
  statusCounts: Record<string, number>;
  completionRate: number;
  averageDuration: number; // In milliseconds
  tasksByAgent: Record<string, number>;
  tasksByMode: Record<string, number>;
}

// Configuration
const TASK_DIR = process.env.TASK_DIR || path.join('.', '.roo', 'task-management');
const TASKS_PATH = path.join(TASK_DIR, 'tasks.json');
const RATE_LIMITS_PATH = path.join(TASK_DIR, 'rate_limits.json');
const COMMAND_EXECUTIONS_PATH = path.join(TASK_DIR, 'command_executions.json');
const MODE_ASSUMPTIONS_PATH = path.join(TASK_DIR, 'mode_assumptions.json');
const MCP_INTERACTIONS_PATH = path.join(TASK_DIR, 'mcp_interactions.json');
const LOGS_DIR = path.join(TASK_DIR, 'logs');

// State storage
interface TaskState {
  tasks: Record<string, Task>;
  rateLimits: Record<string, RateLimitRule>;
  commandExecutions: Record<string, CommandExecution>;
  modeAssumptions: Record<string, ModeAssumption>;
  mcpInteractions: Record<string, MCPInteraction>;
  patternLibrary: Record<string, {
    name: string;
    description: string;
    pattern: string[];
    examples: string[];
    frequency: number;
  }>;
  lastUpdated: string;
}

let taskState: TaskState = {
  tasks: {},
  rateLimits: {},
  commandExecutions: {},
  modeAssumptions: {},
  mcpInteractions: {},
  patternLibrary: {
    'read-write-validate': {
      name: 'Read-Write-Validate',
      description: 'Pattern where an agent reads data, processes it, writes results, then validates',
      pattern: ['read', 'process', 'write', 'validate'],
      examples: ['loading config, modifying values, saving, testing'],
      frequency: 0
    },
    'decompose-delegate-compose': {
      name: 'Decompose-Delegate-Compose',
      description: 'Complex tasks are broken down, assigned to specialized agents, results combined',
      pattern: ['decompose', 'delegate', 'wait', 'compose'],
      examples: ['System strategist creates subtasks for multiple specialist agents'],
      frequency: 0
    }
  },
  lastUpdated: new Date().toISOString()
};

// Initialize directories and state files
async function initializeEnvironment(): Promise<void> {
  // Create directories if they don't exist
  if (!existsSync(TASK_DIR)) {
    mkdirSync(TASK_DIR, { recursive: true });
  }
  
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Load state files if they exist, otherwise create them
  try {
    const [tasks, rateLimits, commandExecutions, modeAssumptions, mcpInteractions] = await Promise.all([
      fs.readFile(TASKS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(RATE_LIMITS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(COMMAND_EXECUTIONS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(MODE_ASSUMPTIONS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(MCP_INTERACTIONS_PATH, 'utf8').catch(() => '{}')
    ]);
    
    taskState = {
      tasks: JSON.parse(tasks),
      rateLimits: JSON.parse(rateLimits),
      commandExecutions: JSON.parse(commandExecutions),
      modeAssumptions: JSON.parse(modeAssumptions),
      mcpInteractions: JSON.parse(mcpInteractions),
      patternLibrary: taskState.patternLibrary, // Keep the default pattern library
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    // If any error occurs during loading, keep the default empty state
    console.error('Error loading task state files:', error);
  }
}

// Helper function to save a specific state file atomically
async function saveStateFile(filePath: string, data: any): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
  await fs.rename(tempPath, filePath);
}

// Save state files
async function saveState(): Promise<void> {
  taskState.lastUpdated = new Date().toISOString();
  
  try {
    await Promise.all([
      saveStateFile(TASKS_PATH, taskState.tasks),
      saveStateFile(RATE_LIMITS_PATH, taskState.rateLimits),
      saveStateFile(COMMAND_EXECUTIONS_PATH, taskState.commandExecutions),
      saveStateFile(MODE_ASSUMPTIONS_PATH, taskState.modeAssumptions),
      saveStateFile(MCP_INTERACTIONS_PATH, taskState.mcpInteractions)
    ]);
  } catch (error) {
    console.error('Error saving state:', error);
  }
}

// Log actions
async function logAction(action: string, data: any): Promise<void> {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      ...data
    };
    
    const logPath = path.join(LOGS_DIR, `${action}_${new Date().toISOString().slice(0, 10)}.log`);
    const logStream = createWriteStream(logPath, { flags: 'a' });
    logStream.write(JSON.stringify(logEntry) + '\n');
    logStream.end();
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

// Check if a command execution is rate limited
function isRateLimited(agentId: string, command: string): { limited: boolean; rule?: RateLimitRule } {
  // Find applicable rate limit rules for this agent and command
  const applicableRules = Object.values(taskState.rateLimits).filter(rule => {
    if (!rule.active || rule.agentId !== agentId) {
      return false;
    }
    
    // Check if command matches the regex pattern
    try {
      const regex = new RegExp(rule.commandPattern);
      return regex.test(command);
    } catch (error) {
      console.error(`Invalid regex pattern in rate limit rule ${rule.id}:`, error);
      return false;
    }
  });
  
  if (applicableRules.length === 0) {
    return { limited: false };
  }
  
  // For each applicable rule, check if the execution would exceed the rate limit
  for (const rule of applicableRules) {
    const now = Date.now();
    const timeWindow = now - rule.timeWindowMs;
    
    // Count recent executions within the time window
    const recentExecutions = Object.values(taskState.commandExecutions)
      .filter(exec => 
        exec.agentId === agentId && 
        new Date(exec.executedAt).getTime() > timeWindow &&
        new RegExp(rule.commandPattern).test(exec.command) &&
        exec.status === 'executed'
      );
    
    if (recentExecutions.length >= rule.maxExecutions) {
      return { limited: true, rule };
    }
  }
  
  return { limited: false };
}

// Detect interaction patterns in MCP calls
function detectInteractionPatterns(interaction: MCPInteraction): string[] {
  const patterns: string[] = [];
  
  // Find recent interactions from the same agent/task
  const recentInteractions = Object.values(taskState.mcpInteractions)
    .filter(i => 
      i.agentId === interaction.agentId && 
      i.taskId === interaction.taskId &&
      new Date(i.timestamp).getTime() < new Date(interaction.timestamp).getTime()
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10); // Look at last 10 interactions
    
  // Add current interaction to the sequence
  const sequence = [...recentInteractions.map(i => i.method), interaction.method];
  
  // Check for known patterns
  for (const [id, patternDef] of Object.entries(taskState.patternLibrary)) {
    // Simple sequence matching
    if (sequenceMatches(sequence, patternDef.pattern)) {
      patterns.push(id);
      
      // Increment pattern frequency
      taskState.patternLibrary[id].frequency += 1;
    }
  }
  
  return patterns;
}

// Helper for pattern matching
function sequenceMatches(sequence: string[], pattern: string[]): boolean {
  if (sequence.length < pattern.length) {
    return false;
  }
  
  // Check for pattern at the end of the sequence
  for (let i = 0; i < pattern.length; i++) {
    if (sequence[sequence.length - pattern.length + i] !== pattern[i]) {
      return false;
    }
  }
  
  return true;
}

// Calculate task statistics
function calculateTaskStats(): TaskStats {
  const tasks = Object.values(taskState.tasks);
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const totalDuration = completedTasks.reduce((total, task) => {
    if (task.completedAt) {
      const duration = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
      return total + duration;
    }
    return total;
  }, 0);
  
  // Count tasks by status
  const statusCounts: Record<string, number> = {};
  tasks.forEach(task => {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  });
  
  // Count tasks by agent
  const tasksByAgent: Record<string, number> = {};
  tasks.forEach(task => {
    tasksByAgent[task.assignedTo] = (tasksByAgent[task.assignedTo] || 0) + 1;
  });
  
  // Count tasks by mode
  const tasksByMode: Record<string, number> = {};
  tasks.forEach(task => {
    tasksByMode[task.targetMode] = (tasksByMode[task.targetMode] || 0) + 1;
  });
  
  return {
    totalTasks: tasks.length,
    statusCounts,
    completionRate: tasks.length ? completedTasks.length / tasks.length : 0,
    averageDuration: completedTasks.length ? totalDuration / completedTasks.length : 0,
    tasksByAgent,
    tasksByMode
  };
}

// Extract relevant context for a subtask
function extractTaskContext(params: any): any {
  const contextData: any = {
    files: params.contextFiles || [],
    variables: params.contextVariables || {},
    dependencies: params.contextDependencies || [],
    assumptions: {},
    previousResults: params.previousResults || null
  };
  
  // If we have a parent task, include its relevant context
  if (params.parentTaskId && taskState.tasks[params.parentTaskId]) {
    const parentTask = taskState.tasks[params.parentTaskId];
    
    // Merge file contexts
    contextData.files = [...new Set([...contextData.files, ...(parentTask.context.files || [])])];
    
    // Merge variables with child overriding parent
    contextData.variables = { 
      ...(parentTask.context.variables || {}), 
      ...contextData.variables 
    };
    
    // Merge dependencies
    contextData.dependencies = [...new Set([
      ...(parentTask.context.dependencies || []), 
      ...contextData.dependencies
    ])];
    
    // Include parent results if requested
    if (params.includeParentResults && parentTask.metadata.results) {
      contextData.previousResults = parentTask.metadata.results;
    }
  }
  
  // Include relevant mode assumptions if available
  if (params.targetMode) {
    const modeAssumptions = Object.values(taskState.modeAssumptions)
      .filter(a => a.modeSlug === params.targetMode)
      .reduce((acc, assumption) => {
        if (!acc[assumption.category]) {
          acc[assumption.category] = {};
        }
        acc[assumption.category][assumption.id] = assumption.assumption;
        return acc;
      }, contextData.assumptions);
    
    contextData.assumptions = modeAssumptions;
  }
  
  return contextData;
}

// MCP Server methods
const methods = {
  /**
   * Creates a new subtask with appropriate context
   */
  new_task: async function(params: any): Promise<any> {
    const { 
      name, 
      description, 
      priority = 'medium',
      createdBy, 
      assignedTo, 
      targetMode,
      parentTaskId,
      tags = [],
      metadata = {}
    } = params;
    
    if (!name) {
      throw new Error('Task name is required');
    }
    
    if (!assignedTo) {
      throw new Error('Assigned agent ID is required');
    }
    
    if (!targetMode) {
      throw new Error('Target mode is required');
    }
    
    // Validate that parent task exists if specified
    if (parentTaskId && !taskState.tasks[parentTaskId]) {
      throw new Error(`Parent task ${parentTaskId} not found`);
    }
    
    // Extract context for the new task
    const context = extractTaskContext(params);
    
    // Generate task ID and timestamps
    const taskId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create task record
    const task: Task = {
      id: taskId,
      parentTaskId,
      name,
      description: description || name,
      status: 'pending',
      priority,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy,
      assignedTo,
      targetMode,
      context,
      metadata,
      tags
    };
    
    // Store in state
    taskState.tasks[taskId] = task;
    await saveState();
    
    // Log task creation
    await logAction('task_created', {
      taskId,
      name,
      assignedTo,
      targetMode,
      parentTaskId
    });
    
    return {
      success: true,
      taskId,
      message: `Task "${name}" created successfully`,
      task
    };
  },
  
  /**
   * Throttles command execution frequency
   */
  rate_limit_command_exec: async function(params: any): Promise<any> {
    const { 
      agentId, 
      command, 
      taskId,
      metadata = {} 
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!command) {
      throw new Error('Command is required');
    }
    
    // Check if this command is rate limited
    const { limited, rule } = isRateLimited(agentId, command);
    
    // Generate execution record
    const executionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create execution record
    const execution: CommandExecution = {
      id: executionId,
      agentId,
      command,
      executedAt: timestamp,
      taskId,
      status: limited ? 'rate_limited' : 'executed',
      metadata: {
        ...metadata,
        rateLimit: limited ? {
          limitRule: rule?.id,
          maxExecutions: rule?.maxExecutions,
          timeWindowMs: rule?.timeWindowMs
        } : undefined
      }
    };
    
    // Store in state
    taskState.commandExecutions[executionId] = execution;
    await saveState();
    
    // Log execution attempt
    await logAction('command_execution', {
      executionId,
      agentId,
      command,
      limited,
      taskId
    });
    
    // Return appropriate response
    if (limited && rule) {
      return {
        success: false,
        limited: true,
        message: `Command execution rate limited: exceeded ${rule.maxExecutions} executions in ${rule.timeWindowMs}ms`,
        waitTime: rule.timeWindowMs,
        executionId
      };
    }
    
    return {
      success: true,
      limited: false,
      message: `Command execution recorded`,
      executionId
    };
  },
  
  /**
   * Creates or updates a rate limit rule
   */
  create_rate_limit_rule: async function(params: any): Promise<any> {
    const { 
      agentId, 
      commandPattern, 
      maxExecutions, 
      timeWindowMs,
      active = true,
      id: existingId
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!commandPattern) {
      throw new Error('Command pattern is required');
    }
    
    if (typeof maxExecutions !== 'number' || maxExecutions <= 0) {
      throw new Error('Max executions must be a positive number');
    }
    
    if (typeof timeWindowMs !== 'number' || timeWindowMs <= 0) {
      throw new Error('Time window must be a positive number');
    }
    
    // Validate regex pattern
    try {
      new RegExp(commandPattern);
    } catch (error) {
      throw new Error(`Invalid regex pattern: ${error.message}`);
    }
    
    // Generate rule ID and timestamps
    const ruleId = existingId || uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create or update rule
    const rule: RateLimitRule = {
      id: ruleId,
      agentId,
      commandPattern,
      maxExecutions,
      timeWindowMs,
      createdAt: existingId && taskState.rateLimits[existingId] 
        ? taskState.rateLimits[existingId].createdAt 
        : timestamp,
      updatedAt: timestamp,
      active
    };
    
    // Store in state
    taskState.rateLimits[ruleId] = rule;
    await saveState();
    
    // Log rule creation/update
    await logAction('rate_limit_rule_updated', {
      ruleId,
      agentId,
      commandPattern,
      maxExecutions,
      timeWindowMs,
      isUpdate: !!existingId
    });
    
    return {
      success: true,
      ruleId,
      message: existingId 
        ? `Rate limit rule ${ruleId} updated successfully` 
        : `Rate limit rule created successfully`,
      rule
    };
  },
  
  /**
   * Pulls contextual information from agents
   */
  extract_mode_assumptions: async function(params: any): Promise<any> {
    const { 
      modeSlug, 
      agentId, 
      taskId,
      category,
      assumption,
      confidence = 0.8,
      source = 'explicit',
      context
    } = params;
    
    if (!modeSlug) {
      throw new Error('Mode slug is required');
    }
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!category) {
      throw new Error('Assumption category is required');
    }
    
    if (assumption === undefined) {
      throw new Error('Assumption content is required');
    }
    
    // Generate assumption ID and timestamp
    const assumptionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create assumption record
    const modeAssumption: ModeAssumption = {
      id: assumptionId,
      modeSlug,
      agentId,
      taskId,
      timestamp,
      category,
      assumption,
      confidence,
      source,
      context
    };
    
    // Store in state
    taskState.modeAssumptions[assumptionId] = modeAssumption;
    await saveState();
    
    // Log assumption extraction
    await logAction('mode_assumption_extracted', {
      assumptionId,
      modeSlug,
      agentId,
      category,
      source
    });
    
    return {
      success: true,
      assumptionId,
      message: `Mode assumption for "${modeSlug}" extracted successfully`,
      assumption: modeAssumption
    };
  },
  
  /**
   * Documents tool usage patterns
   */
  annotate_mcp_interactions: async function(params: any): Promise<any> {
    const { 
      agentId, 
      taskId,
      mcpServer,
      method,
      parameters,
      result,
      duration,
      status = 'success',
      tags = []
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!mcpServer) {
      throw new Error('MCP server name is required');
    }
    
    if (!method) {
      throw new Error('Method name is required');
    }
    
    // Generate interaction ID and timestamp
    const interactionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create interaction record
    const interaction: MCPInteraction = {
      id: interactionId,
      timestamp,
      agentId,
      taskId,
      mcpServer,
      method,
      parameters: parameters || {},
      result,
      duration: duration || 0,
      status,
      tags
    };
    
    // Detect interaction patterns
    const patterns = detectInteractionPatterns(interaction);
    if (patterns.length > 0) {
      interaction.pattern = patterns.join(',');
    }
    
    // Store in state
    taskState.mcpInteractions[interactionId] = interaction;
    await saveState();
    
    // Log interaction
    await logAction('mcp_interaction', {
      interactionId,
      agentId,
      mcpServer,
      method,
      patterns
    });
    
    return {
      success: true,
      interactionId,
      message: `MCP interaction recorded successfully`,
      patterns
    };
  },
  
  /**
   * Creates a new interaction pattern
   */
  create_interaction_pattern: async function(params: any): Promise<any> {
    const { 
      name, 
      description, 
      pattern,
      examples = []
    } = params;
    
    if (!name) {
      throw new Error('Pattern name is required');
    }
    
    if (!description) {
      throw new Error('Pattern description is required');
    }
    
    if (!Array.isArray(pattern) || pattern.length === 0) {
      throw new Error('Pattern must be a non-empty array of method names');
    }
    
    // Generate pattern ID
    const patternId = name.toLowerCase().replace(/\s+/g, '-');
    
    // Create pattern definition
    taskState.patternLibrary[patternId] = {
      name,
      description,
      pattern,
      examples,
      frequency: 0
    };
    
    await saveState();
    
    // Log pattern creation
    await logAction('pattern_created', {
      patternId,
      name,
      pattern
    });
    
    return {
      success: true,
      patternId,
      message: `Interaction pattern "${name}" created successfully`
    };
  },
  
  /**
   * Updates a task's status
   */
  update_task_status: async function(params: any): Promise<any> {
    const { 
      taskId, 
      status, 
      results,
      metadata
    } = params;
    
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    if (!status) {
      throw new Error('Status is required');
    }
    
    const task = taskState.tasks[taskId];
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    
    // Update the task
    task.status = status;
    task.updatedAt = new Date().toISOString();
    
    // Add completion timestamp if completed
    if (status === 'completed' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
    }
    
    // Update metadata if provided
    if (metadata) {
      task.metadata = {
        ...task.metadata,
        ...metadata
      };
    }
    
    // Store results if provided
    if (results !== undefined) {
      task.metadata.results = results;
    }
    
    await saveState();
    
    // Log task update
    await logAction('task_updated', {
      taskId,
      status,
      hasResults: results !== undefined
    });
    
    return {
      success: true,
      message: `Task ${taskId} updated to status: ${status}`,
      task
    };
  },
  
  /**
   * Gets mode assumptions by category
   */
  get_mode_assumptions: async function(params: any): Promise<any> {
    const { 
      modeSlug, 
      category,
      minConfidence = 0
    } = params;
    
    if (!modeSlug) {
      throw new Error('Mode slug is required');
    }
    
    // Filter assumptions by criteria
    let filteredAssumptions = Object.values(taskState.modeAssumptions)
      .filter(a => a.modeSlug === modeSlug && a.confidence >= minConfidence);
    
    if (category) {
      filteredAssumptions = filteredAssumptions.filter(a => a.category === category);
    }
    
    // Group by category
    const groupedAssumptions: Record<string, ModeAssumption[]> = {};
    filteredAssumptions.forEach(assumption => {
      if (!groupedAssumptions[assumption.category]) {
        groupedAssumptions[assumption.category] = [];
      }
      groupedAssumptions[assumption.category].push(assumption);
    });
    
    return {
      success: true,
      assumptions: groupedAssumptions,
      count: filteredAssumptions.length
    };
  },
  
  /**
   * Gets task statistics
   */
  get_task_stats: async function(params: any): Promise<any> {
    const { agentId, modeSlug, dateFrom, dateTo } = params;
    
    // Generate base statistics
    const stats = calculateTaskStats();
    
    // Filter tasks by criteria if specified
    if (agentId || modeSlug || dateFrom || dateTo) {
      const filteredTasks = Object.values(taskState.tasks).filter(task => {
        let include = true;
        
        if (agentId && task.assignedTo !== agentId) {
          include = false;
        }
        
        if (modeSlug && task.targetMode !== modeSlug) {
          include = false;
        }
        
        if (dateFrom && new Date(task.createdAt) < new Date(dateFrom)) {
          include = false;
        }
        
        if (dateTo && new Date(task.createdAt) > new Date(dateTo)) {
          include = false;
        }
        
        return include;
      });
      
      // Calculate filtered stats
      const filteredStats = {
        totalTasks: filteredTasks.length,
        filteredBy: {
          agentId,
          modeSlug,
          dateFrom,
          dateTo
        }
      };
      
      return {
        success: true,
        stats,
        filteredStats
      };
    }
    
    return {
      success: true,
      stats
    };
  },
  
  /**
   * Gets interaction patterns with usage statistics
   */
  get_interaction_patterns: async function(params: any): Promise<any> {
    const { includeExamples = true } = params;
    
    // Get all patterns with their frequency
    const patterns = Object.entries(taskState.patternLibrary).map(([id, pattern]) => ({
      id,
      name: pattern.name,
      description: pattern.description,
      pattern: pattern.pattern,
      examples: includeExamples ? pattern.examples : [],
      frequency: pattern.frequency
    }));
    
    // Sort by frequency (most used first)
    patterns.sort((a, b) => b.frequency - a.frequency);
    
    return {
      success: true,
      patterns,
      totalPatterns: patterns.length
    };
  },
  
  /**
   * Gets recent command executions
   */
  get_command_executions: async function(params: any): Promise<any> {
    const { 
      agentId, 
      limit = 20, 
      status, 
      commandPattern
    } = params;
    
    // Filter executions by criteria
    let filteredExecutions = Object.values(taskState.commandExecutions);
    
    if (agentId) {
      filteredExecutions = filteredExecutions.filter(exec => exec.agentId === agentId);
    }
    
    if (status) {
      filteredExecutions = filteredExecutions.filter(exec => exec.status === status);
    }
    
    if (commandPattern) {
      try {
        const regex = new RegExp(commandPattern);
        filteredExecutions = filteredExecutions.filter(exec => regex.test(exec.command));
      } catch (error) {
        throw new Error(`Invalid command pattern regex: ${error.message}`);
      }
    }
    
    // Sort by execution time (newest first)
    filteredExecutions.sort((a, b) => 
      new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
    );
    
    // Apply limit
    const limitedExecutions = filteredExecutions.slice(0, limit);
    
    return {
      success: true,
      executions: limitedExecutions,
      count: limitedExecutions.length,
      totalMatches: filteredExecutions.length
    };
  }
};

// Start MCP server
async function startServer() {
  try {
    // Initialize environment
    await initializeEnvironment();
    
    // Set up readline interface for stdio transport
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    // Process incoming JSON-RPC requests
    rl.on('line', async (line) => {
      let request: JsonRpcRequest;
      let response: JsonRpcResponse;
      
      try {
        // Parse request
        request = JSON.parse(line);
        
        // Check for valid JSON-RPC 2.0 request
        if (request.jsonrpc !== '2.0' || !request.method) {
          response = {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request'
            },
            id: request.id || null
          };
        }
        // Handle method not found
        else if (!methods[request.method]) {
          response = {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Method not found'
            },
            id: request.id
          };
        }
        // Execute method
        else {
          try {
            const result = await methods[request.method](request.params || {});
            response = {
              jsonrpc: '2.0',
              result,
              id: request.id
            };
          } catch (e) {
            const error = e as Error;
            response = {
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal error',
                data: error.message
              },
              id: request.id
            };
          }
        }
      } catch (e) {
        // Handle parse error
        response = {
          jsonrpc: '2.0',
          error: {
            code: -32700,
            message: 'Parse error'
          },
          id: null
        };
      }
      
      // Send response
      console.log(JSON.stringify(response));
    });
    
    // Handle process signals for graceful shutdown
    process.on('SIGINT', async () => {
      await saveState();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await saveState();
      process.exit(0);
    });
    
    // Broadcast that the server is ready
    const readyMessage = {
      jsonrpc: '2.0',
      method: 'ready',
      params: {
        name: 'task-management-mcp',
        version: '1.0.0',
        methods: Object.keys(methods),
        transport: 'stdio'
      }
    };
    
    console.log(JSON.stringify(readyMessage));
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
