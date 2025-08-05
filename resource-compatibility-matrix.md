# Manufacturing Resource & Work Center Compatibility Matrix

## 📊 RESOURCE-TO-WORK-CENTER ASSIGNMENT MATRIX

### **HIGH-VALUE OPERATORS** (6+ Machines)
| Operator | Machine Count | Qualified Machines | Specialization |
|----------|---------------|-------------------|----------------|
| **Steven Truong** | 9 | VMC-001,VMC-002,VMC-003,VMC-004,VMC-007,LATHE-002,LATHE-004,LATHE-007,REAM-001 | **VERSATILE: Mills + Lathes** |
| **Charles Nguyen** | 7 | VMC-002,VMC-003,VMC-007,LATHE-002,LATHE-004,LATHE-007,REAM-001 | **VERSATILE: Mills + Lathes** |
| **Joel Stevenson** | 6 | LATHE-003,LATHE-004,LATHE-006,LATHE-007,SAW-001,SAW-002 | **LATHE SPECIALIST + Saws** |
| **Noah Johnson** | 6 | VMC-001,VMC-002,VMC-003,REAM-001,BROACH-001,DEBURR-001 | **MILL SPECIALIST + Support** |
| **Aaron Ackelson** | 6 | VMC-005,VMC-006,HMC-002,TAP-001,REAM-001,TUMBLE-001 | **ADVANCED MILLS (4-axis)** |

### **SPECIALIZED OPERATORS** (3-5 Machines)
| Operator | Machines | Primary Specialty |
|----------|----------|-------------------|
| **Drew Darling** | 2 | HMC-001 (HCN 5000 neo), HMC-002 | **4-AXIS HORIZONTAL MILLS** |
| **Aaron Chastain** | 3 | LATHE-001,LATHE-005,LATHE-004 | **PREMIUM LATHES (Live Tooling)** |
| **Trevin Jorgensen** | 5 | LATHE-001,LATHE-002,LATHE-004,LATHE-005,BROACH-001 | **PREMIUM LATHES + Broaching** |
| **Jiordan Hofert** | 5 | LATHE-002,LATHE-003,LATHE-004,LATHE-006,LATHE-007 | **LATHE SPECIALIST** |
| **Kyle Evers** | 5 | SAW-001,SAW-002,REAM-001,VMC-007,LATHE-007 | **SAW SPECIALIST + Support** |
| **Dakota Robertson** | 2 | SAW-001,SAW-002 | **SAW SPECIALIST** |
| **Vilas Morris** | 3 | LATHE-002,LATHE-004,LATHE-006 | **LATHE SPECIALIST** |

## 🔄 MACHINE SUBSTITUTION CAPABILITY MATRIX

### **CRITICAL SUBSTITUTION GROUPS**

#### **4-AXIS HORIZONTAL MILLS** (Premium Capability)
| Machine | Capabilities | Can Substitute | Limitations |
|---------|-------------|----------------|-------------|
| **HMC-001 (HCN 5000 neo)** | 4th axis, Premium | ↔️ HMC-002 | **ONLY Drew Darling qualified** |
| **HMC-002 (MORI-SEIKI MH-50)** | 4th axis, Tier 1 | ↔️ HMC-001 | Drew Darling, Aaron Ackelson |

#### **3-AXIS VERTICAL MILLS** (High Flexibility)
| Machine | Tier | Can Substitute For | Operators Available |
|---------|------|-------------------|-------------------|
| **VMC-001 (HAAS VF-4SS)** | Premium | VMC-002,VMC-003,VMC-007,TAP-001,REAM-001 | Steven Truong, Noah Johnson |
| **VMC-002 (FADAL 4020)** | Standard | VMC-001,VMC-003,VMC-007,TAP-001,REAM-001 | Steven Truong, Noah Johnson, Charles Nguyen |
| **VMC-003 (YAMA-SEIKI BM-1200)** | Standard | VMC-001,VMC-002,VMC-007,TAP-001,REAM-001 | Noah Johnson, Charles Nguyen, Steven Truong |
| **VMC-007 (MORI-SEIKI MV-JUNIOR)** | Tier 1 | VMC-001,VMC-002,VMC-003,TAP-001,REAM-001 | Kyle Evers, Charles Nguyen, Steven Truong |

#### **PREMIUM LATHES** (Live Tooling + Bar Feed)
| Machine | Capabilities | Can Substitute | Qualified Operators |
|---------|-------------|----------------|-------------------|
| **LATHE-001 (MORI-SEIKI SL-204)** | Live tooling, Bar feed, Premium | ↔️ LATHE-003 | **Aaron Chastain, Trevin Jorgensen** |
| **LATHE-003 (FEMCO HL-25)** | Bar feed, Tier 1 | ↔️ LATHE-001 | Joel Stevenson, Jiordan Hofert, Rick Vandehaar |
| **LATHE-005 (MAZAK QTN 350IIMY)** | Live tooling, Premium | ↔️ LATHE-004 | **Aaron Chastain, Trevin Jorgensen** |

## ⚠️ CRITICAL BOTTLENECKS & CONSTRAINTS

### **SEVERE BOTTLENECKS** (1-2 Operators)
| Machine/Group | Operators | Risk Level | Impact |
|---------------|-----------|------------|---------|
| **HMC-001 (HCN 5000 neo)** | Drew Darling ONLY | 🔴 **CRITICAL** | 4th axis work blocked if Drew unavailable |
| **WELD-001** | Calob Lamaster ONLY | 🔴 **CRITICAL** | All welding blocked |
| **Premium Lathes (LATHE-001,005)** | Aaron Chastain, Trevin Jorgensen | 🟡 **HIGH** | Complex lathe work limited |

### **MACHINE SUBSTITUTION LIMITATIONS**

#### **4th Axis Constraint Analysis**
- **HCN 5000 neo (4th axis)** ➜ Can do 3-axis work on any VMC
- **3-axis VMCs** ➜ **CANNOT** do HCN 5000 neo 4th axis work
- **Impact**: Jobs requiring 4th axis are bottlenecked to HMC-001/HMC-002

#### **Live Tooling Constraints**
- **LATHE-001,002,004,005** (Live tooling) ➜ Can do basic turning
- **LATHE-003,006,007** (No live tooling) ➜ **CANNOT** do milling operations
- **Impact**: Complex lathe work limited to 4 machines

## 🎯 OPTIMIZATION OPPORTUNITIES

### **Cross-Training Priorities**
1. **Train more operators on HMC machines** (currently only Drew Darling on HCN 5000 neo)
2. **Train additional welders** (currently only Calob Lamaster)
3. **Expand premium lathe operators** beyond Aaron Chastain & Trevin Jorgensen

### **Machine Utilization Strategy**
1. **Use substitution groups** to spread load across compatible machines
2. **Prioritize 4th axis jobs** to HMC-001/HMC-002 during Drew Darling shifts
3. **Route complex lathe work** to live tooling machines when operators available

### **Resource Allocation Matrix**
| Operation Type | Primary Machines | Backup Machines | Qualified Operators |
|----------------|------------------|-----------------|-------------------|
| **4th Axis Milling** | HMC-001,HMC-002 | None | Drew Darling (HMC-001), Aaron Ackelson (HMC-002) |
| **3-Axis Milling** | VMC-001,002,003,007 | TAP-001,REAM-001 | Steven Truong, Noah Johnson, Charles Nguyen |
| **Complex Turning** | LATHE-001,005 | LATHE-002,004 | Aaron Chastain, Trevin Jorgensen |
| **Basic Turning** | LATHE-003,006,007 | All lathes | Joel Stevenson, Jiordan Hofert, Rick Vandehaar |
| **Welding/Fab** | WELD-001 | None | Calob Lamaster ONLY |
| **Sawing** | SAW-001,SAW-002 | None | Dakota Robertson, Kyle Evers, Joel Stevenson |

This matrix reveals the critical dependencies and substitution possibilities in your manufacturing system.