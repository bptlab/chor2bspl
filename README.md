# chor2bspl

This repository contains a prototypical CLI tool for translating object-aware BPMN choreography diagrams into BSPL information protocols. The implementation was developed in the context of a research paper titled "From Visual Choreographies to Flexible Information Protocols".

## Overview

The CLI tool provides functionalities to:

- Translate object-aware BPMN choreographies into information protocols.
- Find and apply constraints to information protocols.
- Compute distinct interaction sequences for information protocols.

All material used for evaluation can be found in `./resources/`

A screencast (`screencast.mp4`) can be found in the root directory.

## Installation

### Prerequisites

- Node.js (v18 or later)
- npm (Node Package Manager)

### Setup

1. Clone the repository:
   ```bash
   git clone git@github.com:bptlab/chor2bspl.git
   cd chor2bspl
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Link the tool to PATH:
   ```bash
   npm link
   ```

## Usage

### Translate

Translate a object-aware choreography BPMN file to an information protocol. The tool produces a `.bspl`-file with the corresponding formatting and an equivalent `.json`-file for further computations.

```bash
ctob translate -c <path_to_choreography.bpmn> -d <path_to_data_model.json> -l <path_to_lifecycles.json> [-op <output_path>] [-on <output_name>]
```

### Sequences

Compute the number of sequences and print some example sequences for an information protocol (JSON).

```bash
ctob sequences -b <path_to_protocol.json> [-v]
```

### Find Constraints

Find constraints for a information protocol (JSON), given a object-aware choreography BPMN.

```bash
ctob find_constraints -c <path_to_choreography.bpmn> -b <path_to_protocol.json> [-op <output_path>]
```

### Constrain

Refine an information protocol (JSON) with constraints.

```bash
ctob constrain -b <path_to_protocol.json> -c <path_to_constraints.json> [-op <output_path>] [-on <output_name>]
```

## Example: Order Management Choreography

### Step 1: Translate a Choreography to BSPL

```bash
ctob translate -c ./resources/input/order_management/choreography.bpmn -d ./resources/input/order_management/data_model.json -l ./resources/input/order_management/object_lifecycles.json -op ./resources/output/order_management -on protocol
```

### Step 2: Find Constraints

```bash
ctob find_constraints -c ./resources/input/order_management/choreography.bpmn -b ./resources/output/order_management/protocol.json -op ./resources/output/order_management
```

### Step 3: Apply Constraints

```bash
ctob constrain -b ./resources/output/order_management/protocol.json -c ./resources/output/order_management/constraints.json -op ./resources/output/order_management -on refined_protocol
```

### Step 4: Compute Distinct Interaction Sequences

```bash
ctob sequences -b ./resources/output/order_management/protocol.json
ctob sequences -b ./resources/output/order_management/refined_protocol.json
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
