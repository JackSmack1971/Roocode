/**
 * Conductor Functions MCP Server
 * 
 * Implements core orchestration functions for multi-agent Roo Code systems:
 * - route_tool_execution - Routes requests to specialized tools
 * - terminate_mode_on_contract_violation - Stops agents that violate contracts
 * - state_transition - Updates global workflow state
 * - handover_payload - Formats and transfers data between agents
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

interface GlobalState {
  version: number;
  status: string;
  workflows: Record<string, WorkflowState>;
  agents: Record<string, AgentState>;
  tasks: Record<string, TaskState>;
  handovers: Record<string, HandoverPayload>;
  lastUpdated: string;
  lastTransition?: StateTransition;
}

interface WorkflowState {
  id: string;
  name: string;
  status: string;
  tasks: string[];
  startTime: string;
  lastUpdated: string;
}

interface AgentState {
  id: string;
  mode: string;
  status: string;
  capabilities: string[];
  lastActivity: string;
  lastTool?: string;
  terminationReason?: string;
  terminationTime?: string;
  contractViolations?: ContractViolation[];
}

interface TaskState {
  id: string;
  workflowId: string;
  type: string;
  status: string;
  initiatorAgent: string;
  currentAgent: string;
  handovers: string[];
  createdAt: string;
  lastUpdate: string;
  completedAt?: string;
  failureReason?: string;
  metadata?: Record<string, any>;
  result?: any;
}

interface HandoverPayload {
  id: string;
  sourceAgentId: string;
  targetAgentId: string;
  taskId: string;
  timestamp: string;
  payload: any;
  metadata?: Record<string, any>;
}

interface StateTransition {
  from: string;
  to: string;
  timestamp: string;
  reason: string;
  agentId?: string;
  checkpointPath?: string;
}

interface ContractViolation {
  timestamp: string;
  reason: string;
  taskId?: string;
  details?: any;
}

interface LogEntry {
  timestamp: string;
  action: string;
  [key: string]: any;
}

// Configuration
const STATE_DIR = process.env.STATE_DIR || path.join('.', '.roo', 'agent-state');
const GLOBAL_STATE_PATH = path.join(STATE_DIR, 'global_state.json');
const AGENT_LOGS_DIR = path.join(STATE_DIR, 'logs');
const CHECKPOINTS_DIR = path.join(STATE_DIR, 'checkpoints');

// Initialize state directory structure
async function initializeDirectories(): Promise<void> {
  const dirs = [STATE_DIR, AGENT_LOGS_DIR, CHECKPOINTS_DIR];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// Initialize global state if not exists
async function initializeGlobalState(): Promise<GlobalState> {
  try {
    await fs.access(GLOBAL_STATE_PATH);
    const data = await fs.readFile(GLOBAL_STATE_PATH, 'utf8');
    return JSON.parse(data) as GlobalState;
  } catch (error) {
    // File doesn't exist or can't be read, create new state
    const initialState: GlobalState = {
      version: 1,
      status: 'operational',
      workflows: {},
      agents: {},
      tasks: {},
      handovers: {},
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(GLOBAL_STATE_PATH, JSON.stringify(initialState, null, 2));
    return initialState;
  }
}

// Global state variable
let globalState: GlobalState;

// Save state with atomic write pattern
async function saveGlobalState(): Promise<boolean> {
  try {
    // Update timestamp
    globalState.lastUpdated = new Date().toISOString();
    
    const tempPath = `${GLOBAL_STATE_PATH}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(globalState, null, 2));
    await fs.rename(tempPath, GLOBAL_STATE_PATH);
    return true;
  } catch (error) {
    console.error('Error saving global state:', error);
    return false;
  }
}

// Create a checkpoint of the state
async function createCheckpoint(reason: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const checkpointPath = path.join(CHECKPOINTS_DIR, `checkpoint_${timestamp}.json`);
    await fs.writeFile(checkpointPath, JSON.stringify({
      state: globalState,
      reason,
      timestamp: new Date().toISOString()
    }, null, 2));
    return checkpointPath;
  } catch (error) {
    console.error('Error creating checkpoint:', error);
    return '';
  }
}

// Log an action
async function logAction(action: string, data: Record<string, any>, taskId?: string): Promise<void> {
  try {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      action,
      ...data
    };
    
    const logFileName = taskId 
      ? `${action}_${taskId}.json` 
      : `${action}.json`;
    
    const logPath = path.join(AGENT_LOGS_DIR, logFileName);
    
    // Append to log file
    const logStream = createWriteStream(logPath, { flags: 'a' });
    logStream.write(JSON.stringify(logEntry) + '\n');
    logStream.end();
  } catch (error) {
    console.error('Error logging action:', error);
  }
}

// Implement MCP methods
const methods = {
  /**
   * Routes a tool execution request to the appropriate handler
   */
  route_tool_execution: async function(params: any): Promise<any> {
    const { toolName, toolParams, agentId, taskId } = params;
    
    if (!toolName) {
      throw new Error('Tool name is required');
    }
    
    // Log the request
    await logAction('route_tool_execution', {
      toolName,
      agentId,
      taskId,
      params: toolParams
    }, taskId);
    
    // Update agent activity in state if agent exists
    if (agentId && globalState.agents[agentId]) {
      globalState.agents[agentId].lastActivity = new Date().toISOString();
      globalState.agents[agentId].lastTool = toolName;
      await saveGlobalState();
    }
    
    // In a real implementation, this would route to different tool handlers
    // Here we're simulating successful routing
    
    const executionId = uuidv4();
    
    // Update task state if task exists
    if (taskId && globalState.tasks[taskId]) {
      if (!globalState.tasks[taskId].metadata) {
        globalState.tasks[taskId].metadata = {};
      }
      
      if (!globalState.tasks[taskId].metadata.toolExecutions) {
        globalState.tasks[taskId].metadata.toolExecutions = [];
      }
      
      globalState.tasks[taskId].metadata.toolExecutions.push({
        executionId,
        toolName,
        timestamp: new Date().toISOString(),
        agentId,
        status: 'routed'
      });
      
      globalState.tasks[taskId].lastUpdate = new Date().toISOString();
      await saveGlobalState();
    }
    
    return {
      success: true,
      executionId,
      message: `Tool '${toolName}' execution routed successfully`,
      timestamp: new Date().toISOString()
    };
  },
  
  /**
   * Terminates an agent mode when validation fails repeatedly
   */
  terminate_mode_on_contract_violation: async function(params: any): Promise<any> {
    const { agentId, reason, violationCount, taskId, details } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!reason) {
      throw new Error('Violation reason is required');
    }
    
    // Create checkpoint before termination
    const checkpointPath = await createCheckpoint(`Contract violation: ${agentId}`);
    
    // Log termination
    await logAction('terminate_mode', {
      agentId,
      reason,
      violationCount,
      taskId,
      details,
      checkpointPath
    });
    
    // Update agent state
    if (globalState.agents[agentId]) {
      const agent = globalState.agents[agentId];
      
      // Record violation
      if (!agent.contractViolations) {
        agent.contractViolations = [];
      }
      
      agent.contractViolations.push({
        timestamp: new Date().toISOString(),
        reason,
        taskId,
        details
      });
      
      // If this is the second violation or if explicitly requested, terminate
      if (violationCount >= 2 || params.forceTerminate) {
        agent.status = 'terminated';
        agent.terminationReason = reason;
        agent.terminationTime = new Date().toISOString();
      }
      
      await saveGlobalState();
    }
    
    // Update task status if task exists
    if (taskId && globalState.tasks[taskId]) {
      if (violationCount >= 2 || params.forceTerminate) {
        globalState.tasks[taskId].status = 'failed';
        globalState.tasks[taskId].failureReason = `Contract violation by ${agentId}: ${reason}`;
        globalState.tasks[taskId].lastUpdate = new Date().toISOString();
        await saveGlobalState();
      }
    }
    
    return {
      success: true,
      message: `Violation recorded for agent ${agentId}${violationCount >= 2 ? '. Agent terminated.' : ''}`,
      terminated: violationCount >= 2 || params.forceTerminate,
      checkpointPath
    };
  },
  
  /**
   * Updates the global workflow state
   */
  state_transition: async function(params: any): Promise<any> {
    const { newState, reason, agentId, taskId } = params;
    
    if (!newState) {
      throw new Error('New state is required');
    }
    
    if (!reason) {
      throw new Error('Transition reason is required');
    }
    
    const oldState = globalState.status;
    
    // Create checkpoint before state transition
    const checkpointPath = await createCheckpoint(`State transition: ${oldState} -> ${newState}`);
    
    // Update global state
    globalState.status = newState;
    
    const transition: StateTransition = {
      from: oldState,
      to: newState,
      timestamp: new Date().toISOString(),
      reason,
      agentId,
      checkpointPath
    };
    
    globalState.lastTransition = transition;
    
    // Log transition
    await logAction('state_transition', {
      from: oldState,
      to: newState,
      reason,
      agentId,
      taskId,
      checkpointPath
    });
    
    await saveGlobalState();
    
    return {
      success: true,
      message: `System state transitioned from '${oldState}' to '${newState}'`,
      checkpoint: checkpointPath,
      transition
    };
  },
  
  /**
   * Formats and transfers data between agents
   */
  handover_payload: async function(params: any): Promise<any> {
    const { 
      sourceAgentId, 
      targetAgentId, 
      taskId, 
      payload, 
      metadata 
    } = params;
    
    if (!sourceAgentId) {
      throw new Error('Source agent ID is required');
    }
    
    if (!targetAgentId) {
      throw new Error('Target agent ID is required');
    }
    
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    if (payload === undefined) {
      throw new Error('Payload is required');
    }
    
    // Generate handover ID
    const handoverId = uuidv4();
    
    // Structured format for the payload
    const formattedPayload: HandoverPayload = {
      id: handoverId,
      timestamp: new Date().toISOString(),
      sourceAgentId,
      targetAgentId,
      taskId,
      payload,
      metadata: metadata || {}
    };
    
    // Store in state
    if (!globalState.handovers) {
      globalState.handovers = {};
    }
    
    globalState.handovers[handoverId] = formattedPayload;
    
    // Update task state if task exists
    if (globalState.tasks[taskId]) {
      if (!globalState.tasks[taskId].handovers) {
        globalState.tasks[taskId].handovers = [];
      }
      
      globalState.tasks[taskId].handovers.push(handoverId);
      globalState.tasks[taskId].currentAgent = targetAgentId;
      globalState.tasks[taskId].lastUpdate = new Date().toISOString();
    }
    
    // Log handover
    await logAction('handover', formattedPayload, taskId);
    
    await saveGlobalState();
    
    return {
      success: true,
      handoverId,
      message: `Payload handed over from ${sourceAgentId} to ${targetAgentId}`,
      timestamp: formattedPayload.timestamp
    };
  },
  
  /**
   * Gets the current state of a task
   */
  get_task_state: async function(params: any): Promise<any> {
    const { taskId } = params;
    
    if (!taskId) {
      throw new Error('Task ID is required');
    }
    
    if (!globalState.tasks[taskId]) {
      return {
        success: false,
        message: `Task ${taskId} not found`
      };
    }
    
    // Get handovers for this task
    const handovers = globalState.tasks[taskId].handovers || [];
    const handoverDetails = handovers.map(id => globalState.handovers[id]).filter(h => h);
    
    return {
      success: true,
      taskState: globalState.tasks[taskId],
      handovers: handoverDetails
    };
  },
  
  /**
   * Registers a new agent in the system
   */
  register_agent: async function(params: any): Promise<any> {
    const { agentId, mode, capabilities } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!mode) {
      throw new Error('Agent mode is required');
    }
    
    // Add agent to global state
    globalState.agents[agentId] = {
      id: agentId,
      mode,
      capabilities: capabilities || [],
      status: 'active',
      lastActivity: new Date().toISOString()
    };
    
    // Log registration
    await logAction('register_agent', {
      agentId,
      mode,
      capabilities
    });
    
    await saveGlobalState();
    
    return {
      success: true,
      message: `Agent ${agentId} registered successfully`,
      agentId
    };
  },
  
  /**
   * Creates a new task
   */
  create_task: async function(params: any): Promise<any> {
    const { 
      type, 
      workflowId, 
      initiatorAgent, 
      metadata 
    } = params;
    
    if (!type) {
      throw new Error('Task type is required');
    }
    
    if (!initiatorAgent) {
      throw new Error('Initiator agent is required');
    }
    
    // Generate task ID
    const taskId = uuidv4();
    const now = new Date().toISOString();
    
    // Create task
    const task: TaskState = {
      id: taskId,
      workflowId: workflowId || 'default',
      type,
      status: 'pending',
      initiatorAgent,
      currentAgent: initiatorAgent,
      handovers: [],
      createdAt: now,
      lastUpdate: now,
      metadata: metadata || {}
    };
    
    // Add to global state
    globalState.tasks[taskId] = task;
    
    // Add to workflow if exists
    if (globalState.workflows[task.workflowId]) {
      globalState.workflows[task.workflowId].tasks.push(taskId);
      globalState.workflows[task.workflowId].lastUpdated = now;
    } else {
      // Create new workflow if not exists
      globalState.workflows[task.workflowId] = {
        id: task.workflowId,
        name: metadata?.workflowName || task.workflowId,
        status: 'active',
        tasks: [taskId],
        startTime: now,
        lastUpdated: now
      };
    }
    
    // Log task creation
    await logAction('create_task', {
      taskId,
      type,
      workflowId: task.workflowId,
      initiatorAgent,
      metadata
    }, taskId);
    
    await saveGlobalState();
    
    return {
      success: true,
      taskId,
      message: `Task ${taskId} created successfully`,
      task
    };
  }
};

// Main function to start the MCP server
async function startServer() {
  try {
    // Initialize directories and state
    await initializeDirectories();
    globalState = await initializeGlobalState();
    
    // Set up JSON-RPC 2.0 processing via stdio
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    // Handle incoming lines
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
    
    // Handle process signals
    process.on('SIGINT', async () => {
      await saveGlobalState();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await saveGlobalState();
      process.exit(0);
    });
    
    // Broadcast that the server is ready (SSE-style but for stdio)
    const readyMessage = {
      jsonrpc: '2.0',
      method: 'ready',
      params: {
        name: 'conductor-functions-mcp',
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
