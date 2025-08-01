import type { Machine, RoutingOperation } from "@shared/schema";

export interface BarFeederConstraints {
  hasSawOperation: boolean;
  requiredBarLength?: number;
  canUseBarFeeder: boolean;
  alternativeMachines?: Machine[];
  constraintViolations: string[];
}

export class BarFeederService {
  /**
   * Analyzes a job's routing to determine if it can be bar fed
   * Key rules:
   * 1. If job has ANY saw operation in routing, it cannot be bar fed at all
   * 2. If no saw operation, can only move between bar fed lathes
   * 3. SL-204 has 12' feeder, DS30Y/FEMCO have 6' feeders
   * 4. 12' jobs cannot downgrade to 6' feeders, but 6' jobs can upgrade to 12'
   */
  analyzeJobRoutingForBarFeeder(
    jobRouting: RoutingOperation[],
    targetMachine: Machine,
    allMachines: Machine[]
  ): BarFeederConstraints {
    const constraints: BarFeederConstraints = {
      hasSawOperation: false,
      canUseBarFeeder: false,
      constraintViolations: []
    };

    // Check if any routing operation involves sawing
    const sawOperations = jobRouting.filter(op => 
      this.isSawOperation(op)
    );

    if (sawOperations.length > 0) {
      constraints.hasSawOperation = true;
      constraints.canUseBarFeeder = false;
      constraints.constraintViolations.push(
        `Job has saw operations (${sawOperations.map(op => op.name).join(', ')}). Cannot use bar feeder.`
      );
      
      // Get alternative non-bar-fed lathes
      constraints.alternativeMachines = allMachines.filter(m => 
        m.type === "LATHE" && !m.barFeeder && m.status === "Available"
      );
      
      return constraints;
    }

    // No saw operations - check if target machine is bar fed compatible
    if (!targetMachine.barFeeder) {
      constraints.canUseBarFeeder = false;
      constraints.constraintViolations.push(
        `Target machine ${targetMachine.name} is not bar fed. Bar fed jobs can only run on bar fed lathes.`
      );
      
      // Get bar fed alternatives
      constraints.alternativeMachines = allMachines.filter(m => 
        m.type === "LATHE" && m.barFeeder && m.status === "Available"
      );
      
      return constraints;
    }

    // Check bar length constraints if specified in routing
    const barLengthRequirement = this.extractBarLengthRequirement(jobRouting);
    if (barLengthRequirement) {
      constraints.requiredBarLength = barLengthRequirement;
      
      if (!targetMachine.barLength || targetMachine.barLength < barLengthRequirement) {
        constraints.canUseBarFeeder = false;
        constraints.constraintViolations.push(
          `Job requires ${barLengthRequirement}' bar length but ${targetMachine.name} only has ${targetMachine.barLength || 0}' feeder.`
        );
        
        // Get machines with sufficient bar length
        constraints.alternativeMachines = allMachines.filter(m => 
          m.type === "LATHE" && 
          m.barFeeder && 
          m.barLength && 
          m.barLength >= barLengthRequirement &&
          m.status === "Available"
        );
        
        return constraints;
      }
    }

    // All checks passed - can use bar feeder
    constraints.canUseBarFeeder = true;
    return constraints;
  }

  /**
   * Gets all valid bar fed machines for a job
   * Considers saw operations and bar length constraints
   */
  getValidBarFedMachines(
    jobRouting: RoutingOperation[],
    allMachines: Machine[]
  ): Machine[] {
    // If job has saw operations, no bar fed machines are valid
    if (this.hasSawOperations(jobRouting)) {
      return [];
    }

    const barLengthRequirement = this.extractBarLengthRequirement(jobRouting);
    
    return allMachines.filter(machine => {
      if (!machine.barFeeder || machine.type !== "LATHE" || machine.status !== "Available") {
        return false;
      }

      // Check bar length constraint if specified
      if (barLengthRequirement && machine.barLength && machine.barLength < barLengthRequirement) {
        return false;
      }

      return true;
    });
  }

  /**
   * Validates a machine substitution for bar fed jobs
   * Ensures bar fed jobs only move between compatible bar fed machines
   */
  validateBarFedSubstitution(
    originalMachine: Machine,
    substituteMachine: Machine,
    jobRouting: RoutingOperation[]
  ): { isValid: boolean; reason?: string } {
    // If original machine is not bar fed, no special constraints
    if (!originalMachine.barFeeder) {
      return { isValid: true };
    }

    // If job has saw operations, it shouldn't be on bar fed machines at all
    if (this.hasSawOperations(jobRouting)) {
      return { 
        isValid: false, 
        reason: "Job has saw operations and should not be on bar fed machines" 
      };
    }

    // Bar fed jobs must move to other bar fed machines
    if (!substituteMachine.barFeeder) {
      return { 
        isValid: false, 
        reason: "Bar fed jobs can only be moved to other bar fed lathes" 
      };
    }

    // Check bar length constraints
    const barLengthRequirement = this.extractBarLengthRequirement(jobRouting);
    if (barLengthRequirement) {
      if (!substituteMachine.barLength || substituteMachine.barLength < barLengthRequirement) {
        return { 
          isValid: false, 
          reason: `Substitute machine has insufficient bar length (${substituteMachine.barLength || 0}' vs required ${barLengthRequirement}')` 
        };
      }
    }

    // Check if downgrading from 12' to 6' (not allowed)
    if (originalMachine.barLength === 12 && substituteMachine.barLength === 6) {
      return { 
        isValid: false, 
        reason: "Cannot downgrade from 12' bar feeder (SL-204) to 6' bar feeder" 
      };
    }

    return { isValid: true };
  }

  /**
   * Checks if job routing contains any saw operations
   */
  private hasSawOperations(jobRouting: RoutingOperation[]): boolean {
    return jobRouting.some(op => this.isSawOperation(op));
  }

  /**
   * Determines if a routing operation is a saw operation
   */
  private isSawOperation(operation: RoutingOperation): boolean {
    const sawKeywords = ['saw', 'cut', 'cutoff', 'part off', 'sawing'];
    const operationName = operation.name.toLowerCase();
    const operationType = operation.operationType?.toLowerCase();
    
    // Check operation type first
    if (operationType === 'saw') {
      return true;
    }

    // Check operation name for saw keywords
    return sawKeywords.some(keyword => operationName.includes(keyword));
  }

  /**
   * Extracts bar length requirement from job routing
   */
  private extractBarLengthRequirement(jobRouting: RoutingOperation[]): number | null {
    // Look for explicit bar length in routing operations
    for (const operation of jobRouting) {
      if (operation.barLength) {
        return operation.barLength;
      }
      
      // Parse from operation notes if available
      if (operation.notes) {
        const barLengthMatch = operation.notes.match(/(\d+)['']?\s*bar/i);
        if (barLengthMatch) {
          return parseInt(barLengthMatch[1]);
        }
      }
    }
    
    return null;
  }

  /**
   * Gets machine-specific bar feeder information
   */
  getMachineBarFeederInfo(machine: Machine): {
    isBarFed: boolean;
    barLength?: number;
    machineName: string;
    canUpgradeFrom?: number[];
    canDowngradeTo?: number[];
  } {
    const info = {
      isBarFed: machine.barFeeder || false,
      barLength: machine.barLength || undefined,
      machineName: machine.name,
      canUpgradeFrom: [] as number[],
      canDowngradeTo: [] as number[]
    };

    if (machine.barFeeder && machine.barLength) {
      // 12' feeders can accept jobs from 6' feeders (upgrade)
      if (machine.barLength === 12) {
        info.canUpgradeFrom = [6];
      }
      
      // 6' feeders cannot accept jobs from 12' feeders (no downgrade)
      if (machine.barLength === 6) {
        info.canUpgradeFrom = [];
        info.canDowngradeTo = [];
      }
    }

    return info;
  }

  /**
   * Generates human-readable constraint report
   */
  generateConstraintReport(constraints: BarFeederConstraints): string {
    if (constraints.canUseBarFeeder) {
      let report = "✓ Job can use bar feeder";
      if (constraints.requiredBarLength) {
        report += ` (requires ${constraints.requiredBarLength}' bar length)`;
      }
      return report;
    }

    let report = "✗ Job cannot use bar feeder:\n";
    report += constraints.constraintViolations.map(v => `  • ${v}`).join('\n');
    
    if (constraints.alternativeMachines && constraints.alternativeMachines.length > 0) {
      report += `\n\nAlternative machines available:\n`;
      report += constraints.alternativeMachines.map(m => `  • ${m.name}`).join('\n');
    }
    
    return report;
  }
}

export const barFeederService = new BarFeederService();