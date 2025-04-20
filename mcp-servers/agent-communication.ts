/**
 * Agent Communication Functions MCP Server
 * 
 * Implements communication functions for multi-agent Roo Code systems:
 * - send_contract_diff - Flags API contract/schema discrepancies
 * - flag_backward_compatibility_violation - Signals API compatibility issues
 * - chain_to_conductor - Routes messages to the central conductor
 * - submit_resilience_patch - Proposes error recovery patches
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

interface ContractDiff {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  schemaPath: string;
  expectedSchema: any;
  actualSchema: any;
  diffType: 'addition' | 'removal' | 'modification';
  diffDetails: any;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface CompatibilityViolation {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  apiPath: string;
  violationType: 'breaking_change' | 'parameter_change' | 'return_type_change' | 'deprecation';
  previousVersion: string;
  currentVersion: string;
  details: any;
  impact: 'client_error' | 'data_loss' | 'security_risk' | 'performance_degradation';
  mitigationSuggestion?: string;
}

interface AgentMessage {
  id: string;
  timestamp: string;
  sourceAgentId: string;
  targetAgentId: string;
  taskId?: string;
  messageType: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  content: any;
  metadata?: any;
}

interface ResiliencePatch {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  targetComponent: string;
  failureType: string;
  patchType: 'workaround' | 'fix' | 'mitigation' | 'detection';
  patchContent: any;
  testSteps?: any[];
  dependencies?: string[];
  applicationSteps?: any[];
  riskAssessment?: any;
}

// Configuration
const COMM_DIR = process.env.COMM_DIR || path.join('.', '.roo', 'agent-communication');
const CONTRACT_DIFFS_PATH = path.join(COMM_DIR, 'contract_diffs.json');
const COMPATIBILITY_VIOLATIONS_PATH = path.join(COMM_DIR, 'compatibility_violations.json');
const AGENT_MESSAGES_PATH = path.join(COMM_DIR, 'agent_messages.json');
const RESILIENCE_PATCHES_PATH = path.join(COMM_DIR, 'resilience_patches.json');
const LOGS_DIR = path.join(COMM_DIR, 'logs');

// State storage
interface CommunicationState {
  contractDiffs: Record<string, ContractDiff>;
  compatibilityViolations: Record<string, CompatibilityViolation>;
  agentMessages: Record<string, AgentMessage>;
  resiliencePatches: Record<string, ResiliencePatch>;
  lastUpdated: string;
}

let commState: CommunicationState = {
  contractDiffs: {},
  compatibilityViolations: {},
  agentMessages: {},
  resiliencePatches: {},
  lastUpdated: new Date().toISOString()
};

// Initialize directories and state files
async function initializeEnvironment(): Promise<void> {
  // Create directories if they don't exist
  if (!existsSync(COMM_DIR)) {
    mkdirSync(COMM_DIR, { recursive: true });
  }
  
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
  
  // Load state files if they exist, otherwise create them
  try {
    const [contractDiffs, compatibilityViolations, agentMessages, resiliencePatches] = await Promise.all([
      fs.readFile(CONTRACT_DIFFS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(COMPATIBILITY_VIOLATIONS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(AGENT_MESSAGES_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(RESILIENCE_PATCHES_PATH, 'utf8').catch(() => '{}')
    ]);
    
    commState = {
      contractDiffs: JSON.parse(contractDiffs),
      compatibilityViolations: JSON.parse(compatibilityViolations),
      agentMessages: JSON.parse(agentMessages),
      resiliencePatches: JSON.parse(resiliencePatches),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    // If any error occurs during loading, keep the default empty state
    console.error('Error loading communication state files:', error);
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
  commState.lastUpdated = new Date().toISOString();
  
  try {
    await Promise.all([
      saveStateFile(CONTRACT_DIFFS_PATH, commState.contractDiffs),
      saveStateFile(COMPATIBILITY_VIOLATIONS_PATH, commState.compatibilityViolations),
      saveStateFile(AGENT_MESSAGES_PATH, commState.agentMessages),
      saveStateFile(RESILIENCE_PATCHES_PATH, commState.resiliencePatches)
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

// Call the conductor MCP server
async function callConductor(method: string, params: any): Promise<any> {
  // In a real implementation, this would make a call to the conductor MCP server
  // For now, we'll just log it and return a success message
  await logAction('conductor_call', {
    method,
    params
  });
  
  return {
    success: true,
    message: `Conductor method ${method} called successfully`,
    params
  };
}

// Compare JSON schemas to identify differences
function compareSchemas(expected: any, actual: any): any {
  // This is a simplified implementation
  // A real implementation would do a deep comparison of schemas to identify specific differences
  
  const differences: any = {
    additions: [],
    removals: [],
    modifications: []
  };
  
  // Check for property additions and modifications in the actual schema
  Object.keys(actual).forEach(key => {
    if (!(key in expected)) {
      differences.additions.push({ key, value: actual[key] });
    } else if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) {
      differences.modifications.push({
        key,
        expected: expected[key],
        actual: actual[key]
      });
    }
  });
  
  // Check for property removals from the expected schema
  Object.keys(expected).forEach(key => {
    if (!(key in actual)) {
      differences.removals.push({ key, value: expected[key] });
    }
  });
  
  return differences;
}

// Determine the severity of a contract diff
function assessDiffSeverity(diff: any): 'low' | 'medium' | 'high' | 'critical' {
  // Breaking changes like removals have higher severity
  if (diff.removals && diff.removals.length > 0) {
    return 'high';
  }
  
  // Type changes are often more serious than additions
  if (diff.modifications && diff.modifications.length > 0) {
    return 'medium';
  }
  
  // Additions are typically less problematic
  if (diff.additions && diff.additions.length > 0) {
    return 'low';
  }
  
  return 'low';
}

// Helper to determine the diff type based on the differences
function determineDiffType(differences: any): 'addition' | 'removal' | 'modification' {
  if (differences.removals && differences.removals.length > 0) {
    return 'removal';
  } else if (differences.modifications && differences.modifications.length > 0) {
    return 'modification';
  } else {
    return 'addition';
  }
}

// MCP Server methods
const methods = {
  /**
   * Flags API contract/schema discrepancies
   */
  send_contract_diff: async function(params: any): Promise<any> {
    const { 
      agentId, 
      taskId, 
      schemaPath, 
      expectedSchema, 
      actualSchema 
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!schemaPath) {
      throw new Error('Schema path is required');
    }
    
    if (!expectedSchema || !actualSchema) {
      throw new Error('Both expected and actual schemas are required');
    }
    
    // Generate unique ID for this contract diff
    const diffId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Compare schemas to identify differences
    const differences = compareSchemas(expectedSchema, actualSchema);
    const diffType = determineDiffType(differences);
    const severity = assessDiffSeverity(differences);
    
    // Create contract diff record
    const contractDiff: ContractDiff = {
      id: diffId,
      timestamp,
      agentId,
      taskId,
      schemaPath,
      expectedSchema,
      actualSchema,
      diffType,
      diffDetails: differences,
      status: 'pending',
      severity
    };
    
    // Store in state
    commState.contractDiffs[diffId] = contractDiff;
    await saveState();
    
    // Log the contract diff
    await logAction('contract_diff', contractDiff);
    
    // Notify conductor if severity is high or critical
    if (severity === 'high' || severity === 'critical') {
      await callConductor('notify_contract_diff', {
        diffId,
        schemaPath,
        severity,
        agentId,
        taskId
      });
    }
    
    return {
      success: true,
      diffId,
      severity,
      message: `Contract diff recorded for schema path: ${schemaPath}`,
      differences
    };
  },
  
  /**
   * Signals API compatibility issues
   */
  flag_backward_compatibility_violation: async function(params: any): Promise<any> {
    const { 
      agentId, 
      taskId, 
      apiPath, 
      violationType, 
      previousVersion, 
      currentVersion, 
      details, 
      impact 
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!apiPath) {
      throw new Error('API path is required');
    }
    
    if (!violationType) {
      throw new Error('Violation type is required');
    }
    
    if (!impact) {
      throw new Error('Impact assessment is required');
    }
    
    // Generate unique ID for this violation
    const violationId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create compatibility violation record
    const violation: CompatibilityViolation = {
      id: violationId,
      timestamp,
      agentId,
      taskId,
      apiPath,
      violationType,
      previousVersion: previousVersion || 'unknown',
      currentVersion: currentVersion || 'unknown',
      details: details || {},
      impact,
      mitigationSuggestion: params.mitigationSuggestion
    };
    
    // Store in state
    commState.compatibilityViolations[violationId] = violation;
    await saveState();
    
    // Log the violation
    await logAction('compatibility_violation', violation);
    
    // Always notify conductor for compatibility violations
    await callConductor('notify_compatibility_violation', {
      violationId,
      apiPath,
      violationType,
      impact,
      agentId,
      taskId
    });
    
    return {
      success: true,
      violationId,
      message: `Backward compatibility violation recorded for API: ${apiPath}`,
      impact
    };
  },
  
  /**
   * Routes messages to the central conductor
   */
  chain_to_conductor: async function(params: any): Promise<any> {
    const { 
      sourceAgentId, 
      taskId, 
      messageType, 
      priority, 
      content, 
      metadata 
    } = params;
    
    if (!sourceAgentId) {
      throw new Error('Source agent ID is required');
    }
    
    if (!messageType) {
      throw new Error('Message type is required');
    }
    
    if (!content) {
      throw new Error('Message content is required');
    }
    
    // Generate unique ID for this message
    const messageId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create message record
    const message: AgentMessage = {
      id: messageId,
      timestamp,
      sourceAgentId,
      targetAgentId: 'fullstack-conductor', // The conductor is always the target for chained messages
      taskId,
      messageType,
      priority: priority || 'medium',
      content,
      metadata: metadata || {}
    };
    
    // Store in state
    commState.agentMessages[messageId] = message;
    await saveState();
    
    // Log the message
    await logAction('chain_message', message);
    
    // Forward message to conductor
    const conductorResponse = await callConductor('receive_chained_message', {
      messageId,
      sourceAgentId,
      messageType,
      priority: message.priority,
      content,
      taskId,
      metadata: message.metadata
    });
    
    return {
      success: true,
      messageId,
      message: `Message chained to conductor successfully`,
      conductorResponse
    };
  },
  
  /**
   * Proposes error recovery patches
   */
  submit_resilience_patch: async function(params: any): Promise<any> {
    const { 
      agentId, 
      taskId, 
      targetComponent, 
      failureType, 
      patchType, 
      patchContent,
      testSteps,
      dependencies,
      applicationSteps,
      riskAssessment 
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!targetComponent) {
      throw new Error('Target component is required');
    }
    
    if (!failureType) {
      throw new Error('Failure type is required');
    }
    
    if (!patchType) {
      throw new Error('Patch type is required');
    }
    
    if (!patchContent) {
      throw new Error('Patch content is required');
    }
    
    // Generate unique ID for this patch
    const patchId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create resilience patch record
    const patch: ResiliencePatch = {
      id: patchId,
      timestamp,
      agentId,
      taskId,
      targetComponent,
      failureType,
      patchType,
      patchContent,
      testSteps,
      dependencies,
      applicationSteps,
      riskAssessment
    };
    
    // Store in state
    commState.resiliencePatches[patchId] = patch;
    await saveState();
    
    // Log the patch
    await logAction('resilience_patch', patch);
    
    // Notify conductor about the patch
    await callConductor('notify_resilience_patch', {
      patchId,
      agentId,
      targetComponent,
      failureType,
      patchType,
      taskId
    });
    
    return {
      success: true,
      patchId,
      message: `Resilience patch submitted for component: ${targetComponent}`,
      patchType
    };
  },
  
  /**
   * Gets the status of a submitted contract diff
   */
  get_contract_diff_status: async function(params: any): Promise<any> {
    const { diffId } = params;
    
    if (!diffId) {
      throw new Error('Diff ID is required');
    }
    
    const diff = commState.contractDiffs[diffId];
    if (!diff) {
      return {
        success: false,
        message: `Contract diff ${diffId} not found`
      };
    }
    
    return {
      success: true,
      diff,
      status: diff.status
    };
  },
  
  /**
   * Gets the status of a submitted compatibility violation
   */
  get_compatibility_violation_status: async function(params: any): Promise<any> {
    const { violationId } = params;
    
    if (!violationId) {
      throw new Error('Violation ID is required');
    }
    
    const violation = commState.compatibilityViolations[violationId];
    if (!violation) {
      return {
        success: false,
        message: `Compatibility violation ${violationId} not found`
      };
    }
    
    return {
      success: true,
      violation
    };
  },
  
  /**
   * Gets a list of resilience patches for a specific component
   */
  get_resilience_patches_for_component: async function(params: any): Promise<any> {
    const { targetComponent } = params;
    
    if (!targetComponent) {
      throw new Error('Target component is required');
    }
    
    const patches = Object.values(commState.resiliencePatches)
      .filter(patch => patch.targetComponent === targetComponent);
    
    return {
      success: true,
      patches,
      count: patches.length
    };
  },
  
  /**
   * Searches for messages by criteria
   */
  search_messages: async function(params: any): Promise<any> {
    const { 
      sourceAgentId, 
      targetAgentId, 
      messageType, 
      taskId, 
      priority,
      startTime,
      endTime,
      limit = 10
    } = params;
    
    // Filter messages based on provided criteria
    let filteredMessages = Object.values(commState.agentMessages);
    
    if (sourceAgentId) {
      filteredMessages = filteredMessages.filter(msg => msg.sourceAgentId === sourceAgentId);
    }
    
    if (targetAgentId) {
      filteredMessages = filteredMessages.filter(msg => msg.targetAgentId === targetAgentId);
    }
    
    if (messageType) {
      filteredMessages = filteredMessages.filter(msg => msg.messageType === messageType);
    }
    
    if (taskId) {
      filteredMessages = filteredMessages.filter(msg => msg.taskId === taskId);
    }
    
    if (priority) {
      filteredMessages = filteredMessages.filter(msg => msg.priority === priority);
    }
    
    if (startTime) {
      filteredMessages = filteredMessages.filter(msg => msg.timestamp >= startTime);
    }
    
    if (endTime) {
      filteredMessages = filteredMessages.filter(msg => msg.timestamp <= endTime);
    }
    
    // Sort by timestamp (newest first) and limit results
    filteredMessages.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const limitedMessages = filteredMessages.slice(0, limit);
    
    return {
      success: true,
      messages: limitedMessages,
      count: limitedMessages.length,
      totalMatches: filteredMessages.length
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
    
    // Broadcast that the server is ready
    const readyMessage = {
      jsonrpc: '2.0',
      method: 'ready',
      params: {
        name: 'agent-communication-mcp',
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
