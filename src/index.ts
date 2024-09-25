#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs-extra';
import { DataModel, ObjectLifecycles, Protocol, translateToBSPL } from './analysis/translator';
import { parse } from './parser';
import { getInitiator, getMessageNameFromTask, getRespondent, jsonBSPLDeduplicateMessages, jsonToBSPL } from './helper';
import path from 'path';
import { getBsplInteractionSequences } from './analysis/bsplTraces';
import { getChorInteractionSequences } from './analysis/chorTraces';
import { Constraint, findConstraints } from './analysis/findConstraints';
import { constrainProtocol } from './analysis/constrainProtocol';

const program = new Command();

interface JsonFile {
  [key: string]: any;
}

function checkFileExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
}

function readFile(filePath: string): string {
  checkFileExists(filePath);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Error reading file: ${filePath}`);
  }
}

function writeFile(filePath: string, fileName: string, data: string): void {
  const targetPath = path.join(filePath, fileName);
  console.info(`Writing file: ${targetPath}`);

  if (fs.existsSync(targetPath)) {
    console.warn(`Warning: File already exists and will be overwritten: ${targetPath}`);
  }

  try {
    fs.ensureDirSync(filePath);
    fs.writeFileSync(`${targetPath}`, data);
  } catch (err) {
    throw new Error(`Error writing file: ${targetPath}`);
  }
}

function readJsonFile(filePath: string): JsonFile {
  try {
    return JSON.parse(readFile(filePath));
  } catch (err) {
    throw new Error(`Error reading or parsing JSON file: ${filePath}`);
  }
}

async function translate(bpmn: string, dataModel: DataModel, lifecycles: ObjectLifecycles, outputPath?: string, outputName?: string): Promise<void> {
  try {
    const choreography = await parse(bpmn);
    const mergedProtocolJson = translateToBSPL(
      choreography.name,
      choreography.tasks,
      choreography.participants,
      dataModel,
      lifecycles,
    );

    writeFile(outputPath || './resources', `${outputName || choreography.name}.json`, JSON.stringify(mergedProtocolJson));

    const mergedProtocolJsonDeduplicated = jsonBSPLDeduplicateMessages(mergedProtocolJson);
    const mergedProtocol = jsonToBSPL(mergedProtocolJsonDeduplicated)

    writeFile(outputPath || './resources', `${outputName || choreography.name}.bspl`, mergedProtocol);
  } catch (err) {
    throw new Error(`Error in translate function: ${err}`);
  }
}

function bsplSequences(bspl: Protocol, verbose = false): void {
  const bsplDeduplicated = jsonBSPLDeduplicateMessages(bspl);

  const bsplInteractionSequences = getBsplInteractionSequences(bsplDeduplicated);

  const sequences = bsplInteractionSequences.map(s => `[${s
    .map(m => `${verbose ? m.from : m.from.substring(0, 2)}>${verbose ? m.to : m.to.substring(0, 2)}:${m.name}`).join(', ')}]`);

  const uniqueSequences = [...new Set(sequences)];

  const interactionSequenceCount = uniqueSequences.length;
  console.info(`\nBSPL interaction sequences:`)

  for (const uniqueSequence of uniqueSequences.slice(0, verbose ? interactionSequenceCount : 100)) {
    console.info(uniqueSequence);
  }
  if (!verbose && interactionSequenceCount > 100) {
    console.info(`... and ${interactionSequenceCount - 100} more.`)
  }

  console.info(`\nFound ${interactionSequenceCount} BSPL interaction sequences.`)
}

program
  .command('translate')
  .description('Translate object-aware choreography BPMN file to information protocol')
  .requiredOption('-c, --choreography <path>', 'Path to object-aware choreography .bpmn file')
  .requiredOption('-d, --data_model <path>', 'Path to data model .json file')
  .requiredOption('-l, --lifecycles <path>', 'Path to lifecycles .json file')
  .option('-op, --output_path <path>', 'Path for output files')
  .option('-on, --output_name <name>', 'Name for output files')
  .action(async (options) => {
    const { choreography, data_model, lifecycles, output_path, output_name } = options;
    try {
      console.info('Translating choreography to information protocol...');
      const bpmn = readFile(choreography);
      const dataModel = readJsonFile(data_model) as DataModel;
      const objectLifecycles = readJsonFile(lifecycles) as ObjectLifecycles;
      await translate(bpmn, dataModel, objectLifecycles, output_path, output_name);
      console.info('Done.');
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('sequences')
  .description('Get number of sequences and some example sequences')
  .requiredOption('-b, --bspl <path>', 'Path to information protocol .json file')
  .option('-v, --verbose', 'Print all sequences')
  .action(async (options) => {
    const { bspl, verbose } = options;
    try {
      console.info('Computing interaction sequences for BSPL:')
      const bsplJson = readJsonFile(bspl) as Protocol;
      await bsplSequences(bsplJson, verbose);
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('find_constraints')
  .description('Find constraints from object-aware choreography BPMN file and information protocol JSON file')
  .requiredOption('-c, --choreography <path>', 'Path to object-aware choreography .bpmn file')
  .requiredOption('-b, --bspl <path>', 'Path to information protocol .json file')
  .option('-op, --output_path <name>', 'Name for output path')
  .action(async (options) => {
    const { choreography, bspl, output_path } = options;
    try {
      const bpmn = readFile(choreography);
      const protocol = readJsonFile(bspl) as Protocol;
      const constraints = await findConstraints(bpmn, protocol);
      if (output_path) {
        writeFile(output_path, 'constraints.json', JSON.stringify(constraints));
      } else {
        console.info('Found constraints:');
        console.info(constraints);
      }
    } catch (err) {
      console.error(err);
    }
  });

program
  .command('constrain')
  .description('Add constraints to information protocol JSON file')
  .requiredOption('-b, --bspl <path>', 'Path to information protocol .json file')
  .requiredOption('-c, --constraints <path>', 'Path to constraints .json file')
  .option('-op, --output_path <path>', 'Path for output files')
  .option('-on, --output_name <name>', 'Name for output files')
  .action((options) => {
    const { bspl, constraints, output_path, output_name } = options;
    try {
      const protocol = readJsonFile(bspl) as Protocol;
      const protocolConstraints = readJsonFile(constraints) as Constraint[];
      const constrainedProtocol = constrainProtocol(protocol, protocolConstraints);
      writeFile(output_path || './resources', `${output_name || protocol.name}.json`, JSON.stringify(constrainedProtocol));
      const deduplicatedConstrainedProtocol = jsonBSPLDeduplicateMessages(constrainedProtocol);
      const bsplOutput = jsonToBSPL(deduplicatedConstrainedProtocol);
      writeFile(output_path || './resources', `${output_name || protocol.name}.bspl`, bsplOutput);
    } catch (err) {
      console.error(err);
    }
  });

program.parse(process.argv);
