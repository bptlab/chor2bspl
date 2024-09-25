import { ChoreographyTask, FlowNode } from "bpmn-moddle";
import { getPrecedingFlowNodes, getSucceedingFlowNodes } from "../helper";
import { ChoreographyData, parse } from "../parser";
import { MessageSchema, Protocol } from "./translator";
import { getBsplInteractionSequences } from "./bsplTraces";
import { getChorInteractionSequences } from "./chorTraces";

export interface Constraint {
  from: string;
  fromTaskId: string;
  fromMessageId: number;
  to: string;
  toTaskId: string;
  toMessageId: number;
  type: "precedes" | "exclusive";
}

function isSubTraceMatching(subTrace: MessageSchema[], bpmnTrace: ChoreographyTask[]) {
  if (bpmnTrace.length < subTrace.length) {
    return false;
  }
  for (let i = 0; i < subTrace.length; i++) {
    if (subTrace[i].taskId !== bpmnTrace[i].id) {
      return false;
    }
  }
  return true;
}

function getSucceedingChoreographyTasks(node: FlowNode): ChoreographyTask[] {
  if (!node) {
    return [];
  }

  if (node.$type === 'bpmn:ChoreographyTask') {
    return [node as ChoreographyTask];
  }

  if (node.$type === 'bpmn:ExclusiveGateway' || node.$type === 'bpmn:EventBasedGateway' || node.$type === 'bpmn:ParallelGateway') {
    return getSucceedingFlowNodes(node).flatMap(getSucceedingChoreographyTasks);
  }

  return [];
}

function getAllSucceedingChoreographyTasks(startNode: ChoreographyTask): ChoreographyTask[] {
  const succeedingNodes = getSucceedingFlowNodes(startNode);
  return succeedingNodes.flatMap(getSucceedingChoreographyTasks);
}


function getPrecedingChoreographyTasksRec(node: FlowNode): ChoreographyTask[] {
  if (!node) {
    return [];
  }

  if (node.$type === 'bpmn:ChoreographyTask') {
    return [node as ChoreographyTask];
  }

  if (node.$type === 'bpmn:ExclusiveGateway' || node.$type === 'bpmn:EventBasedGateway' || node.$type === 'bpmn:ParallelGateway') {
    return getPrecedingFlowNodes(node).flatMap(getPrecedingChoreographyTasksRec);
  }

  return [];
}

function getAllPrecedingChoreographyTasks(startNode: ChoreographyTask): ChoreographyTask[] {
  const precedingNodes = getPrecedingFlowNodes(startNode);
  return precedingNodes.flatMap(getPrecedingChoreographyTasksRec);
}


function deriveConstraints(chor: ChoreographyData, trace: MessageSchema[], bspl: Protocol): Constraint[] {
  const displacedMessage = trace[trace.length - 1];

  const task = chor.tasks.find(t => t.id === displacedMessage.taskId);

  if (!task) {
    throw new Error(`Could not find task for message ${displacedMessage}`);
  }

  const constraints: Constraint[] = [];

  const precedingTasks = getAllPrecedingChoreographyTasks(task);
  const succeedingTasks = getAllSucceedingChoreographyTasks(task);
  const exclusiveTasks = getPrecedingFlowNodes(task).flatMap(node => {
    if (node.$type === 'bpmn:ExclusiveGateway' || node.$type === 'bpmn:EventBasedGateway') {
      return getSucceedingFlowNodes(node).map(n => n as ChoreographyTask).filter(n => n.id !== task.id)
    }
    return [];
  })

  precedingTasks.forEach(precedingTask => {
    if (!trace.find(m => m.taskId === precedingTask.id)) {
      const precedingMessages = bspl.messages.filter(m => m.taskId === precedingTask.id);
      precedingMessages.forEach(precedingMessage => {
        constraints.push({
          from: `${precedingMessage.from}->${precedingMessage.to}: ${precedingMessage.name}`,
          fromMessageId: precedingMessage.id,
          fromTaskId: precedingTask.id,
          to: `${displacedMessage.from}->${displacedMessage.to}: ${displacedMessage.name}`,
          toMessageId: displacedMessage.id,
          toTaskId: task.id,
          type: 'precedes'
        });
      });
    }
  });

  succeedingTasks.forEach(succeedingTask => {
    if (trace.find(m => m.taskId === succeedingTask.id)) {

      const succeedingMessages = bspl.messages.filter(m => m.taskId === succeedingTask.id);
      succeedingMessages.forEach(succeedingMessage => {
        constraints.push({
          from: `${displacedMessage.from}->${displacedMessage.to}: ${displacedMessage.name}`,
          fromMessageId: displacedMessage.id,
          fromTaskId: task.id,
          to: `${succeedingMessage.from}->${succeedingMessage.to}: ${succeedingMessage.name}`,
          toMessageId: succeedingMessage.id,
          toTaskId: succeedingTask.id,
          type: 'precedes'
        });
      });
    }
  });

  exclusiveTasks.forEach(exclusiveTask => {
    if (trace.find(m => m.taskId === exclusiveTask.id)) {
      const exclusiveMessages = bspl.messages.filter(m => m.taskId === exclusiveTask.id);
      exclusiveMessages.forEach(exclusiveMessage => {
        constraints.push({
          from: `${displacedMessage.from}->${displacedMessage.to}: ${displacedMessage.name}`,
          fromMessageId: displacedMessage.id,
          fromTaskId: task.id,
          to: `${exclusiveMessage.from}->${exclusiveMessage.to}: ${exclusiveMessage.name}`,
          toMessageId: exclusiveMessage.id,
          toTaskId: exclusiveTask.id,
          type: 'exclusive',
        });
      });
    }
  });

  return constraints;
}

export async function findConstraints(bpmn: string, bspl: Protocol): Promise<Constraint[]> {

  const bsplIS = getBsplInteractionSequences(bspl);
  const bpmnTraces = await getChorInteractionSequences(bpmn);
  const wrongTraces: MessageSchema[][] = [];

  const displacedMessages: Set<MessageSchema> = new Set();

  const parsedChor = await parse(bpmn);
  const constraintAcc: Constraint[] = [];

  bsplIS.forEach(trace => {
    for (let subTraceIndex = 1; subTraceIndex <= trace.length; subTraceIndex++) {
      const subTrace = trace.slice(0, subTraceIndex);

      let matchFound = false;

      for (const bpmnTrace of bpmnTraces) {
        if (isSubTraceMatching(subTrace, bpmnTrace)) {
          matchFound = true;
          break;
        }
      }

      if (!matchFound) {
        constraintAcc.push(...deriveConstraints(parsedChor, subTrace, bspl));
        wrongTraces.push(subTrace);
        displacedMessages.add(subTrace[subTrace.length - 1]);
        return;
      }
    }
  });

  const constraints = constraintAcc.reduce((acc: Constraint[], constraint) => {
    if (!acc.some(c => c.from === constraint.from && c.to === constraint.to && c.type === constraint.type) && 
      !acc.find(c => c.type === "exclusive" && c.fromMessageId === constraint.toMessageId && c.toMessageId === constraint.fromMessageId)) {
      acc.push(constraint);
    }
    return acc;
  }, []);

  return constraints;
}
