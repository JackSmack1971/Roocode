/**
 * Validation and Reporting Functions MCP Server
 * 
 * Implements advanced validation and analysis functions for multi-agent Roo Code systems:
 * - publish_strategy_update - Signals system-wide strategy changes
 * - start_failure_reflexion - Analyzes root causes of failures
 * - annotate_motif_pattern - Tags recurring patterns in system behavior
 * - schema_migration_report - Generates database migration audit logs
 * - qa_assertion_matrix - Produces test coverage analysis
 * - security_risk_profile - Creates security assessment reports
 * - confirm_findings - Validates security review results
 * - invoke_recursive_diagnostics - Performs deep failure analysis
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

interface StrategyUpdate {
  id: string;
  timestamp: string;
  agentId: string;
  title: string;
  description: string;
  reasoning: string;
  targetAudience: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  implementationSteps?: any[];
  validUntil?: string;
  status: 'draft' | 'published' | 'archived' | 'superseded';
  version: number;
  previousVersionId?: string;
}

interface FailureReflexion {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  failureType: string;
  failureDescription: string;
  affectedComponents: string[];
  rootCauses: {
    cause: string;
    probability: number; // 0.0 to 1.0
    evidence: string[];
  }[];
  contributingFactors: string[];
  timeline: {
    time: string;
    event: string;
    significance: string;
  }[];
  recommendations: {
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    effort: 'minimal' | 'moderate' | 'significant' | 'major';
    impact: 'low' | 'medium' | 'high';
  }[];
  relatedPatterns?: string[];
}

interface MotifPattern {
  id: string;
  timestamp: string;
  agentId: string;
  name: string;
  description: string;
  occurrences: {
    taskId?: string;
    timestamp: string;
    context: string;
    agentsInvolved: string[];
  }[];
  patternType: 'behavior' | 'communication' | 'error' | 'workflow' | 'architectural';
  consequences: string[];
  recommendations?: string[];
  status: 'observed' | 'confirmed' | 'mitigated' | 'resolved';
  tags: string[];
}

interface SchemaMigration {
  id: string;
  timestamp: string;
  agentId: string;
  dbType: string; // e.g., 'postgresql', 'mysql'
  migrationName: string;
  sourceSchema: any;
  targetSchema: any;
  changes: {
    type: 'add_table' | 'drop_table' | 'add_column' | 'drop_column' | 'modify_column' | 'add_constraint' | 'drop_constraint' | 'other';
    description: string;
    impact: 'low' | 'medium' | 'high';
    sql: string;
    rollbackSql?: string;
  }[];
  backwardCompatible: boolean;
  dataLossPotential: boolean;
  validationChecks: {
    name: string;
    passed: boolean;
    description: string;
  }[];
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'needs_changes';
  reviewerId?: string;
  reviewComments?: string;
}

interface QAAssertionMatrix {
  id: string;
  timestamp: string;
  agentId: string;
  moduleId: string;
  moduleName: string;
  testSuite: string;
  functionsCovered: {
    name: string;
    path: string;
    testCoverage: number; // 0.0 to 1.0
    assertionTypes: string[];
    edgeCasesCovered: string[];
    edgeCasesMissing?: string[];
  }[];
  codeCoverage: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  testQualityMetrics: {
    complexity: number; // 0.0 to 1.0
    maintainability: number; // 0.0 to 1.0
    reliability: number; // 0.0 to 1.0
  };
  criticalPathsTested: boolean;
  securityAssertions: boolean;
  regressionPrevention: boolean;
  recommendations?: string[];
}

interface SecurityRiskProfile {
  id: string;
  timestamp: string;
  agentId: string;
  targetComponent: string;
  scope: 'file' | 'module' | 'service' | 'application' | 'system';
  vulnerabilities: {
    id: string;
    type: string; // OWASP category or CWE ID
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    likelihood: 'rare' | 'unlikely' | 'possible' | 'likely' | 'almost_certain';
    impact: 'negligible' | 'minor' | 'moderate' | 'major' | 'severe';
    location: string;
    remediation: string;
    codeSnippet?: string;
  }[];
  securityControls: {
    type: string;
    description: string;
    effectiveness: 'ineffective' | 'partially_effective' | 'effective' | 'very_effective';
    implementation: 'missing' | 'partial' | 'complete' | 'exceeds_requirements';
  }[];
  complianceStatus: {
    standard: string;
    status: 'compliant' | 'partially_compliant' | 'non_compliant' | 'not_applicable';
    gaps?: string[];
  }[];
  overallRiskScore: number; // 0.0 to 1.0
  recommendedActions: {
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  }[];
  reviewStatus: 'draft' | 'pending_review' | 'approved' | 'rejected';
}

interface SecurityFindings {
  id: string;
  timestamp: string;
  agentId: string;
  profileId: string;
  targetComponent: string;
  confirmationLevel: 'preliminary' | 'verified' | 'confirmed';
  verificationMethod: string[];
  additionalFindings: {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    evidence: string;
  }[];
  excludedVulnerabilities: {
    id: string;
    reason: string;
  }[];
  overallAssessment: string;
  confidenceLevel: number; // 0.0 to 1.0
  reviewerId: string;
  finalRiskScore: number; // 0.0 to 1.0
  approved: boolean;
  escalations?: {
    reason: string;
    to: string;
    status: 'pending' | 'addressed' | 'dismissed';
  }[];
}

interface RecursiveDiagnostics {
  id: string;
  timestamp: string;
  agentId: string;
  taskId?: string;
  targetComponent: string;
  failurePoint: string;
  recursionDepth: number;
  analysisSteps: {
    level: number;
    component: string;
    observation: string;
    childComponents?: string[];
    status: 'analyzed' | 'skipped' | 'error';
  }[];
  dependencyGraph: {
    nodes: {
      id: string;
      type: string;
      status: 'healthy' | 'degraded' | 'failed' | 'unknown';
    }[];
    edges: {
      source: string;
      target: string;
      type: string;
    }[];
  };
  rootFailureCause: {
    component: string;
    issue: string;
    confidence: number; // 0.0 to 1.0
  };
  cascadingEffects: {
    component: string;
    effect: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];
  fixRecommendations: {
    component: string;
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }[];
  diagnosticSummary: string;
}

// Configuration
const VALIDATION_DIR = process.env.VALIDATION_DIR || path.join('.', '.roo', 'validation-reporting');
const STRATEGY_UPDATES_PATH = path.join(VALIDATION_DIR, 'strategy_updates.json');
const FAILURE_REFLEXIONS_PATH = path.join(VALIDATION_DIR, 'failure_reflexions.json');
const MOTIF_PATTERNS_PATH = path.join(VALIDATION_DIR, 'motif_patterns.json');
const SCHEMA_MIGRATIONS_PATH = path.join(VALIDATION_DIR, 'schema_migrations.json');
const QA_MATRICES_PATH = path.join(VALIDATION_DIR, 'qa_matrices.json');
const SECURITY_PROFILES_PATH = path.join(VALIDATION_DIR, 'security_profiles.json');
const SECURITY_FINDINGS_PATH = path.join(VALIDATION_DIR, 'security_findings.json');
const RECURSIVE_DIAGNOSTICS_PATH = path.join(VALIDATION_DIR, 'recursive_diagnostics.json');
const LOGS_DIR = path.join(VALIDATION_DIR, 'logs');
const REPORTS_DIR = path.join(VALIDATION_DIR, 'reports');
const ARTIFACTS_DIR = path.join(VALIDATION_DIR, 'artifacts');

// State storage
interface ValidationState {
  strategyUpdates: Record<string, StrategyUpdate>;
  failureReflexions: Record<string, FailureReflexion>;
  motifPatterns: Record<string, MotifPattern>;
  schemaMigrations: Record<string, SchemaMigration>;
  qaMatrices: Record<string, QAAssertionMatrix>;
  securityProfiles: Record<string, SecurityRiskProfile>;
  securityFindings: Record<string, SecurityFindings>;
  recursiveDiagnostics: Record<string, RecursiveDiagnostics>;
  lastUpdated: string;
}

let validationState: ValidationState = {
  strategyUpdates: {},
  failureReflexions: {},
  motifPatterns: {},
  schemaMigrations: {},
  qaMatrices: {},
  securityProfiles: {},
  securityFindings: {},
  recursiveDiagnostics: {},
  lastUpdated: new Date().toISOString()
};

// Initialize directories and state files
async function initializeEnvironment(): Promise<void> {
  // Create directories if they don't exist
  const dirs = [
    VALIDATION_DIR,
    LOGS_DIR,
    REPORTS_DIR,
    ARTIFACTS_DIR
  ];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
  
  // Load state files if they exist, otherwise create them
  try {
    const [
      strategyUpdates,
      failureReflexions,
      motifPatterns,
      schemaMigrations,
      qaMatrices,
      securityProfiles,
      securityFindings,
      recursiveDiagnostics
    ] = await Promise.all([
      fs.readFile(STRATEGY_UPDATES_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(FAILURE_REFLEXIONS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(MOTIF_PATTERNS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(SCHEMA_MIGRATIONS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(QA_MATRICES_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(SECURITY_PROFILES_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(SECURITY_FINDINGS_PATH, 'utf8').catch(() => '{}'),
      fs.readFile(RECURSIVE_DIAGNOSTICS_PATH, 'utf8').catch(() => '{}')
    ]);
    
    validationState = {
      strategyUpdates: JSON.parse(strategyUpdates),
      failureReflexions: JSON.parse(failureReflexions),
      motifPatterns: JSON.parse(motifPatterns),
      schemaMigrations: JSON.parse(schemaMigrations),
      qaMatrices: JSON.parse(qaMatrices),
      securityProfiles: JSON.parse(securityProfiles),
      securityFindings: JSON.parse(securityFindings),
      recursiveDiagnostics: JSON.parse(recursiveDiagnostics),
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    // If any error occurs during loading, keep the default empty state
    console.error('Error loading validation state files:', error);
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
  validationState.lastUpdated = new Date().toISOString();
  
  try {
    await Promise.all([
      saveStateFile(STRATEGY_UPDATES_PATH, validationState.strategyUpdates),
      saveStateFile(FAILURE_REFLEXIONS_PATH, validationState.failureReflexions),
      saveStateFile(MOTIF_PATTERNS_PATH, validationState.motifPatterns),
      saveStateFile(SCHEMA_MIGRATIONS_PATH, validationState.schemaMigrations),
      saveStateFile(QA_MATRICES_PATH, validationState.qaMatrices),
      saveStateFile(SECURITY_PROFILES_PATH, validationState.securityProfiles),
      saveStateFile(SECURITY_FINDINGS_PATH, validationState.securityFindings),
      saveStateFile(RECURSIVE_DIAGNOSTICS_PATH, validationState.recursiveDiagnostics)
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

// Generate a report file
async function generateReport(reportType: string, reportData: any): Promise<string> {
  try {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportId = `${reportType}_${timestamp}`;
    const reportPath = path.join(REPORTS_DIR, `${reportId}.json`);
    
    // Create report with metadata
    const report = {
      reportId,
      reportType,
      generatedAt: new Date().toISOString(),
      data: reportData
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    return reportPath;
  } catch (error) {
    console.error('Error generating report:', error);
    throw error;
  }
}

// Calculate risk score based on vulnerabilities
function calculateRiskScore(vulnerabilities: any[]): number {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return 0;
  }
  
  // Define weights for severity levels
  const severityWeights = {
    'low': 0.25,
    'medium': 0.5,
    'high': 0.75,
    'critical': 1.0
  };
  
  // Calculate weighted average
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const vuln of vulnerabilities) {
    const weight = severityWeights[vuln.severity] || 0.5;
    weightedSum += weight * weight; // Square to emphasize higher severities
    totalWeight += 1;
  }
  
  // Normalize to 0-1 range, with higher being more severe
  return totalWeight > 0 ? Math.min(weightedSum / totalWeight, 1.0) : 0;
}

// Check if a pattern matches current observations
function matchMotifPattern(pattern: MotifPattern, newObservation: any): boolean {
  // This is a simplified implementation that could be enhanced with more sophisticated pattern matching
  
  // For example, we could check if the new observation contains keywords from the pattern description
  const keywords = pattern.description.toLowerCase().split(/\s+/);
  const observationText = (newObservation.description || '').toLowerCase();
  
  let matchCount = 0;
  for (const keyword of keywords) {
    if (keyword.length > 3 && observationText.includes(keyword)) { // Only consider meaningful keywords
      matchCount++;
    }
  }
  
  // If more than 30% of keywords match, consider it a potential match
  return matchCount / keywords.length > 0.3;
}

// Check if new diagnostic overlaps with existing ones
function findRelatedDiagnostics(newDiagnostic: RecursiveDiagnostics): string[] {
  const relatedIds: string[] = [];
  
  // Look for diagnostics with overlapping components
  for (const [id, diagnostic] of Object.entries(validationState.recursiveDiagnostics)) {
    if (diagnostic.targetComponent === newDiagnostic.targetComponent || 
        diagnostic.failurePoint === newDiagnostic.failurePoint) {
      relatedIds.push(id);
      continue;
    }
    
    // Check for overlapping components in the dependency graph
    const newComponents = newDiagnostic.dependencyGraph.nodes.map(n => n.id);
    const existingComponents = diagnostic.dependencyGraph.nodes.map(n => n.id);
    
    const overlap = newComponents.filter(c => existingComponents.includes(c));
    if (overlap.length > 0) {
      relatedIds.push(id);
    }
  }
  
  return relatedIds;
}

// Notify all relevant agents about a strategy update
async function notifyAgentsOfStrategy(strategyUpdate: StrategyUpdate): Promise<void> {
  // In a real implementation, this would use the communication MCP to send messages
  // to all relevant agents. For now, we'll just log it.
  
  await logAction('strategy_notification', {
    strategyId: strategyUpdate.id,
    title: strategyUpdate.title,
    targetAudience: strategyUpdate.targetAudience,
    priority: strategyUpdate.priority
  });
}

// MCP Server methods
const methods = {
  /**
   * Signals system-wide strategy changes
   */
  publish_strategy_update: async function(params: any): Promise<any> {
    const { 
      agentId,
      title,
      description,
      reasoning,
      targetAudience,
      priority = 'medium',
      affectedComponents,
      implementationSteps,
      validUntil,
      previousVersionId
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!title) {
      throw new Error('Strategy title is required');
    }
    
    if (!description) {
      throw new Error('Strategy description is required');
    }
    
    if (!affectedComponents || !Array.isArray(affectedComponents) || affectedComponents.length === 0) {
      throw new Error('Affected components must be a non-empty array');
    }
    
    // Check if this is an update to an existing strategy
    let version = 1;
    if (previousVersionId && validationState.strategyUpdates[previousVersionId]) {
      version = validationState.strategyUpdates[previousVersionId].version + 1;
      
      // Mark previous version as superseded
      validationState.strategyUpdates[previousVersionId].status = 'superseded';
    }
    
    // Generate strategy ID and timestamp
    const strategyId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create strategy update record
    const strategyUpdate: StrategyUpdate = {
      id: strategyId,
      timestamp,
      agentId,
      title,
      description,
      reasoning,
      targetAudience: targetAudience || ['all'],
      priority,
      affectedComponents,
      implementationSteps,
      validUntil,
      status: 'published',
      version,
      previousVersionId
    };
    
    // Store in state
    validationState.strategyUpdates[strategyId] = strategyUpdate;
    await saveState();
    
    // Generate report
    const reportPath = await generateReport('strategy_update', strategyUpdate);
    
    // Log strategy publication
    await logAction('strategy_published', {
      strategyId,
      title,
      priority,
      version,
      reportPath
    });
    
    // Notify affected agents
    await notifyAgentsOfStrategy(strategyUpdate);
    
    return {
      success: true,
      strategyId,
      version,
      reportPath,
      message: `Strategy update "${title}" published successfully`
    };
  },
  
  /**
   * Analyzes root causes of failures
   */
  start_failure_reflexion: async function(params: any): Promise<any> {
    const { 
      agentId,
      taskId,
      failureType,
      failureDescription,
      affectedComponents,
      rootCauses,
      contributingFactors,
      timeline,
      recommendations
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!failureType) {
      throw new Error('Failure type is required');
    }
    
    if (!failureDescription) {
      throw new Error('Failure description is required');
    }
    
    if (!affectedComponents || !Array.isArray(affectedComponents)) {
      throw new Error('Affected components must be an array');
    }
    
    if (!rootCauses || !Array.isArray(rootCauses) || rootCauses.length === 0) {
      throw new Error('Root causes must be a non-empty array');
    }
    
    // Generate reflexion ID and timestamp
    const reflexionId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Look for related patterns
    let relatedPatterns: string[] = [];
    for (const [id, pattern] of Object.entries(validationState.motifPatterns)) {
      if (matchMotifPattern(pattern, {
        type: failureType,
        description: failureDescription,
        components: affectedComponents
      })) {
        relatedPatterns.push(id);
      }
    }
    
    // Create failure reflexion record
    const failureReflexion: FailureReflexion = {
      id: reflexionId,
      timestamp,
      agentId,
      taskId,
      failureType,
      failureDescription,
      affectedComponents,
      rootCauses,
      contributingFactors: contributingFactors || [],
      timeline: timeline || [],
      recommendations: recommendations || [],
      relatedPatterns
    };
    
    // Store in state
    validationState.failureReflexions[reflexionId] = failureReflexion;
    await saveState();
    
    // Generate report
    const reportPath = await generateReport('failure_reflexion', failureReflexion);
    
    // Log reflexion
    await logAction('failure_reflexion', {
      reflexionId,
      failureType,
      affectedComponents,
      relatedPatterns
    });
    
    return {
      success: true,
      reflexionId,
      reportPath,
      relatedPatterns,
      message: `Failure reflexion for "${failureType}" created successfully`
    };
  },
  
  /**
   * Tags recurring patterns in system behavior
   */
  annotate_motif_pattern: async function(params: any): Promise<any> {
    const { 
      agentId,
      name,
      description,
      occurrences,
      patternType,
      consequences,
      recommendations,
      tags = []
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!name) {
      throw new Error('Pattern name is required');
    }
    
    if (!description) {
      throw new Error('Pattern description is required');
    }
    
    if (!occurrences || !Array.isArray(occurrences) || occurrences.length === 0) {
      throw new Error('Occurrences must be a non-empty array');
    }
    
    if (!patternType) {
      throw new Error('Pattern type is required');
    }
    
    // Generate pattern ID and timestamp
    const patternId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create motif pattern record
    const motifPattern: MotifPattern = {
      id: patternId,
      timestamp,
      agentId,
      name,
      description,
      occurrences,
      patternType,
      consequences: consequences || [],
      recommendations,
      status: 'observed',
      tags
    };
    
    // Store in state
    validationState.motifPatterns[patternId] = motifPattern;
    await saveState();
    
    // Log pattern annotation
    await logAction('motif_pattern', {
      patternId,
      name,
      patternType,
      occurrenceCount: occurrences.length
    });
    
    return {
      success: true,
      patternId,
      message: `Motif pattern "${name}" annotated successfully`,
      pattern: motifPattern
    };
  },
  
  /**
   * Generates database migration audit logs
   */
  schema_migration_report: async function(params: any): Promise<any> {
    const { 
      agentId,
      dbType,
      migrationName,
      sourceSchema,
      targetSchema,
      changes,
      backwardCompatible,
      dataLossPotential,
      validationChecks
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!dbType) {
      throw new Error('Database type is required');
    }
    
    if (!migrationName) {
      throw new Error('Migration name is required');
    }
    
    if (!sourceSchema) {
      throw new Error('Source schema is required');
    }
    
    if (!targetSchema) {
      throw new Error('Target schema is required');
    }
    
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      throw new Error('Changes must be a non-empty array');
    }
    
    // Generate migration ID and timestamp
    const migrationId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create schema migration record
    const schemaMigration: SchemaMigration = {
      id: migrationId,
      timestamp,
      agentId,
      dbType,
      migrationName,
      sourceSchema,
      targetSchema,
      changes,
      backwardCompatible: backwardCompatible !== false, // Default to true if not specified
      dataLossPotential: dataLossPotential === true, // Default to false if not specified
      validationChecks: validationChecks || [],
      reviewStatus: 'pending'
    };
    
    // Store in state
    validationState.schemaMigrations[migrationId] = schemaMigration;
    await saveState();
    
    // Generate report
    const reportPath = await generateReport('schema_migration', schemaMigration);
    
    // Log migration report
    await logAction('schema_migration', {
      migrationId,
      migrationName,
      dbType,
      changeCount: changes.length,
      backwardCompatible,
      dataLossPotential
    });
    
    return {
      success: true,
      migrationId,
      reportPath,
      reviewStatus: 'pending',
      message: `Schema migration report for "${migrationName}" generated successfully`
    };
  },
  
  /**
   * Produces test coverage analysis
   */
  qa_assertion_matrix: async function(params: any): Promise<any> {
    const { 
      agentId,
      moduleId,
      moduleName,
      testSuite,
      functionsCovered,
      codeCoverage,
      testQualityMetrics,
      criticalPathsTested,
      securityAssertions,
      regressionPrevention,
      recommendations
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!moduleId) {
      throw new Error('Module ID is required');
    }
    
    if (!moduleName) {
      throw new Error('Module name is required');
    }
    
    if (!testSuite) {
      throw new Error('Test suite name is required');
    }
    
    if (!functionsCovered || !Array.isArray(functionsCovered)) {
      throw new Error('Functions covered must be an array');
    }
    
    if (!codeCoverage) {
      throw new Error('Code coverage metrics are required');
    }
    
    // Generate matrix ID and timestamp
    const matrixId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Create QA assertion matrix record
    const qaMatrix: QAAssertionMatrix = {
      id: matrixId,
      timestamp,
      agentId,
      moduleId,
      moduleName,
      testSuite,
      functionsCovered,
      codeCoverage,
      testQualityMetrics: testQualityMetrics || {
        complexity: 0.5,
        maintainability: 0.5,
        reliability: 0.5
      },
      criticalPathsTested: criticalPathsTested !== false, // Default to true if not specified
      securityAssertions: securityAssertions !== false, // Default to true if not specified
      regressionPrevention: regressionPrevention !== false, // Default to true if not specified
      recommendations
    };
    
    // Store in state
    validationState.qaMatrices[matrixId] = qaMatrix;
    await saveState();
    
    // Generate report with visualizations
    const reportPath = await generateReport('qa_matrix', qaMatrix);
    
    // Log QA matrix
    await logAction('qa_matrix', {
      matrixId,
      moduleName,
      testSuite,
      functionCount: functionsCovered.length,
      overallCoverage: (codeCoverage.lines + codeCoverage.branches + codeCoverage.functions + codeCoverage.statements) / 4
    });
    
    return {
      success: true,
      matrixId,
      reportPath,
      message: `QA assertion matrix for "${moduleName}" generated successfully`
    };
  },
  
  /**
   * Creates security assessment reports
   */
  security_risk_profile: async function(params: any): Promise<any> {
    const { 
      agentId,
      targetComponent,
      scope,
      vulnerabilities,
      securityControls,
      complianceStatus,
      recommendedActions
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!targetComponent) {
      throw new Error('Target component is required');
    }
    
    if (!scope) {
      throw new Error('Assessment scope is required');
    }
    
    if (!vulnerabilities || !Array.isArray(vulnerabilities)) {
      throw new Error('Vulnerabilities must be an array');
    }
    
    if (!securityControls || !Array.isArray(securityControls)) {
      throw new Error('Security controls must be an array');
    }
    
    // Generate profile ID and timestamp
    const profileId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Calculate overall risk score based on vulnerabilities
    const overallRiskScore = calculateRiskScore(vulnerabilities);
    
    // Create security risk profile record
    const securityProfile: SecurityRiskProfile = {
      id: profileId,
      timestamp,
      agentId,
      targetComponent,
      scope,
      vulnerabilities,
      securityControls,
      complianceStatus: complianceStatus || [],
      overallRiskScore,
      recommendedActions: recommendedActions || [],
      reviewStatus: 'draft'
    };
    
    // Store in state
    validationState.securityProfiles[profileId] = securityProfile;
    await saveState();
    
    // Generate report
    const reportPath = await generateReport('security_profile', securityProfile);
    
    // Log security profile
    await logAction('security_profile', {
      profileId,
      targetComponent,
      scope,
      vulnerabilityCount: vulnerabilities.length,
      overallRiskScore
    });
    
    return {
      success: true,
      profileId,
      reportPath,
      riskScore: overallRiskScore,
      reviewStatus: 'draft',
      message: `Security risk profile for "${targetComponent}" created successfully`
    };
  },
  
  /**
   * Validates security review results
   */
  confirm_findings: async function(params: any): Promise<any> {
    const { 
      agentId,
      profileId,
      confirmationLevel,
      verificationMethod,
      additionalFindings,
      excludedVulnerabilities,
      overallAssessment,
      confidenceLevel,
      reviewerId,
      approved
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!profileId) {
      throw new Error('Security profile ID is required');
    }
    
    if (!confirmationLevel) {
      throw new Error('Confirmation level is required');
    }
    
    if (!verificationMethod || !Array.isArray(verificationMethod)) {
      throw new Error('Verification methods must be an array');
    }
    
    if (!overallAssessment) {
      throw new Error('Overall assessment is required');
    }
    
    if (!reviewerId) {
      throw new Error('Reviewer ID is required');
    }
    
    // Check if the referenced security profile exists
    if (!validationState.securityProfiles[profileId]) {
      throw new Error(`Security profile ${profileId} not found`);
    }
    
    const securityProfile = validationState.securityProfiles[profileId];
    
    // Generate findings ID and timestamp
    const findingsId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Adjust risk score based on confirmation findings
    let finalRiskScore = securityProfile.overallRiskScore;
    
    // If there are additional findings, increase the risk score
    if (additionalFindings && additionalFindings.length > 0) {
      const additionalRiskImpact = additionalFindings.reduce((total, finding) => {
        const severityWeights = {
          'low': 0.05,
          'medium': 0.1,
          'high': 0.15,
          'critical': 0.2
        };
        return total + (severityWeights[finding.severity] || 0.1);
      }, 0);
      
      finalRiskScore = Math.min(finalRiskScore + additionalRiskImpact, 1.0);
    }
    
    // If vulnerabilities are excluded, decrease the risk score
    if (excludedVulnerabilities && excludedVulnerabilities.length > 0) {
      // Find the original vulnerabilities that are being excluded
      const excludedIds = excludedVulnerabilities.map(e => e.id);
      const excludedOriginals = securityProfile.vulnerabilities.filter(v => excludedIds.includes(v.id));
      
      const exclusionImpact = excludedOriginals.reduce((total, vuln) => {
        const severityWeights = {
          'low': 0.05,
          'medium': 0.1,
          'high': 0.15,
          'critical': 0.2
        };
        return total + (severityWeights[vuln.severity] || 0.1);
      }, 0);
      
      finalRiskScore = Math.max(finalRiskScore - exclusionImpact, 0.0);
    }
    
    // Create security findings record
    const securityFindings: SecurityFindings = {
      id: findingsId,
      timestamp,
      agentId,
      profileId,
      targetComponent: securityProfile.targetComponent,
      confirmationLevel,
      verificationMethod,
      additionalFindings: additionalFindings || [],
      excludedVulnerabilities: excludedVulnerabilities || [],
      overallAssessment,
      confidenceLevel: confidenceLevel || 0.8,
      reviewerId,
      finalRiskScore,
      approved: approved !== false // Default to true if not specified
    };
    
    // Store in state
    validationState.securityFindings[findingsId] = securityFindings;
    
    // Update original security profile status
    securityProfile.reviewStatus = approved !== false ? 'approved' : 'rejected';
    
    await saveState();
    
    // Generate report
    const reportPath = await generateReport('security_findings', securityFindings);
    
    // Log findings confirmation
    await logAction('security_findings', {
      findingsId,
      profileId,
      targetComponent: securityProfile.targetComponent,
      confirmationLevel,
      additionalFindingsCount: (additionalFindings || []).length,
      approved: securityFindings.approved
    });
    
    return {
      success: true,
      findingsId,
      reportPath,
      profileStatus: securityProfile.reviewStatus,
      finalRiskScore,
      message: `Security findings for "${securityProfile.targetComponent}" confirmed successfully`
    };
  },
  
  /**
   * Performs deep failure analysis
   */
  invoke_recursive_diagnostics: async function(params: any): Promise<any> {
    const { 
      agentId,
      taskId,
      targetComponent,
      failurePoint,
      recursionDepth,
      analysisSteps,
      dependencyGraph,
      rootFailureCause,
      cascadingEffects,
      fixRecommendations,
      diagnosticSummary
    } = params;
    
    if (!agentId) {
      throw new Error('Agent ID is required');
    }
    
    if (!targetComponent) {
      throw new Error('Target component is required');
    }
    
    if (!failurePoint) {
      throw new Error('Failure point is required');
    }
    
    if (!recursionDepth) {
      throw new Error('Recursion depth is required');
    }
    
    if (!dependencyGraph) {
      throw new Error('Dependency graph is required');
    }
    
    if (!rootFailureCause) {
      throw new Error('Root failure cause is required');
    }
    
    // Generate diagnostic ID and timestamp
    const diagnosticId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Check for related diagnostics
    const diagnosticRecord: RecursiveDiagnostics = {
      id: diagnosticId,
      timestamp,
      agentId,
      taskId,
      targetComponent,
      failurePoint,
      recursionDepth,
      analysisSteps: analysisSteps || [],
      dependencyGraph,
      rootFailureCause,
      cascadingEffects: cascadingEffects || [],
      fixRecommendations: fixRecommendations || [],
      diagnosticSummary: diagnosticSummary || `Failure in ${targetComponent} at ${failurePoint}`
    };
    
    // Find related diagnostics
    const relatedDiagnostics = findRelatedDiagnostics(diagnosticRecord);
    
    // Store in state
    validationState.recursiveDiagnostics[diagnosticId] = diagnosticRecord;
    await saveState();
    
    // Generate report with dependency visualization
    const reportPath = await generateReport('recursive_diagnostics', {
      diagnostic: diagnosticRecord,
      relatedDiagnostics: relatedDiagnostics.map(id => validationState.recursiveDiagnostics[id])
    });
    
    // Log diagnostic invocation
    await logAction('recursive_diagnostics', {
      diagnosticId,
      targetComponent,
      failurePoint,
      recursionDepth,
      relatedDiagnosticsCount: relatedDiagnostics.length
    });
    
    return {
      success: true,
      diagnosticId,
      reportPath,
      relatedDiagnostics,
      message: `Recursive diagnostics for "${targetComponent}" completed successfully`
    };
  },
  
  /**
   * Gets a list of all strategy updates
   */
  get_strategy_updates: async function(params: any): Promise<any> {
    const { status, affectingComponent, limit = 10 } = params;
    
    // Filter strategies by criteria
    let filteredStrategies = Object.values(validationState.strategyUpdates);
    
    if (status) {
      filteredStrategies = filteredStrategies.filter(s => s.status === status);
    }
    
    if (affectingComponent) {
      filteredStrategies = filteredStrategies.filter(s => 
        s.affectedComponents.includes(affectingComponent)
      );
    }
    
    // Sort by timestamp (newest first)
    filteredStrategies.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    // Apply limit
    const limitedStrategies = filteredStrategies.slice(0, limit);
    
    return {
      success: true,
      strategies: limitedStrategies,
      count: limitedStrategies.length,
      totalMatches: filteredStrategies.length
    };
  },
  
  /**
   * Gets a strategy update by ID
   */
  get_strategy_by_id: async function(params: any): Promise<any> {
    const { strategyId } = params;
    
    if (!strategyId) {
      throw new Error('Strategy ID is required');
    }
    
    const strategy = validationState.strategyUpdates[strategyId];
    if (!strategy) {
      return {
        success: false,
        message: `Strategy ${strategyId} not found`
      };
    }
    
    return {
      success: true,
      strategy
    };
  },
  
  /**
   * Gets motif patterns by type
   */
  get_motif_patterns: async function(params: any): Promise<any> {
    const { patternType, status, limit = 10 } = params;
    
    // Filter patterns by criteria
    let filteredPatterns = Object.values(validationState.motifPatterns);
    
    if (patternType) {
      filteredPatterns = filteredPatterns.filter(p => p.patternType === patternType);
    }
    
    if (status) {
      filteredPatterns = filteredPatterns.filter(p => p.status === status);
    }
    
    // Sort by timestamp (newest first)
    filteredPatterns.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    // Apply limit
    const limitedPatterns = filteredPatterns.slice(0, limit);
    
    return {
      success: true,
      patterns: limitedPatterns,
      count: limitedPatterns.length,
      totalMatches: filteredPatterns.length
    };
  },
  
  /**
   * Gets schema migrations pending review
   */
  get_pending_schema_migrations: async function(params: any): Promise<any> {
    const { limit = 10 } = params;
    
    // Filter migrations that are pending review
    const pendingMigrations = Object.values(validationState.schemaMigrations)
      .filter(m => m.reviewStatus === 'pending')
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
    
    return {
      success: true,
      migrations: pendingMigrations,
      count: pendingMigrations.length
    };
  },
  
  /**
   * Updates schema migration review status
   */
  update_migration_review: async function(params: any): Promise<any> {
    const { 
      migrationId, 
      reviewerId, 
      reviewStatus, 
      reviewComments 
    } = params;
    
    if (!migrationId) {
      throw new Error('Migration ID is required');
    }
    
    if (!reviewerId) {
      throw new Error('Reviewer ID is required');
    }
    
    if (!reviewStatus) {
      throw new Error('Review status is required');
    }
    
    // Check if the migration exists
    if (!validationState.schemaMigrations[migrationId]) {
      throw new Error(`Migration ${migrationId} not found`);
    }
    
    // Update the migration
    validationState.schemaMigrations[migrationId].reviewStatus = reviewStatus;
    validationState.schemaMigrations[migrationId].reviewerId = reviewerId;
    
    if (reviewComments) {
      validationState.schemaMigrations[migrationId].reviewComments = reviewComments;
    }
    
    await saveState();
    
    // Log review update
    await logAction('migration_review', {
      migrationId,
      reviewerId,
      reviewStatus,
      hasComments: !!reviewComments
    });
    
    return {
      success: true,
      message: `Schema migration ${migrationId} review updated to ${reviewStatus}`,
      migration: validationState.schemaMigrations[migrationId]
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
        name: 'validation-reporting-mcp',
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
