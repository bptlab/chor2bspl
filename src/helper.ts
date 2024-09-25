import { ChoreographyTask, Message, FlowNode } from 'bpmn-moddle';
import { DataClass, DataModel, DataObject, MessageSchema, ObjectLifecycle, Protocol } from './analysis/translator';

export function is(...types: string[]) {
  return (element: any) => {
    return types.some((type) => element.$instanceOf(type));
  };
}

export function getMessages(choreographyTask: ChoreographyTask): Message[] {
  return choreographyTask.messageFlowRef.map(messageFlow => messageFlow.messageRef);
}

export function getClassDependencies(dataClass: DataClass, dataModel: DataModel) {
  return dataClass.relations
    .filter(relation => relation.lowerBound > 0)
    .map(relation => dataModel[relation.class]);
}

export function getDataObjectFromText(text: string): DataObject | null {
  if (!text) return null;
  const nameMatches = text.match(/(.*)\[/i);
  if (!nameMatches || nameMatches.length < 2) {
    return null;
  }
  const name = nameMatches[1];
  const formattedName = name.replace(/\s/ig, "");

  const stateMatches = text.match(/\[(.*)\]/i);
  if (!stateMatches || stateMatches.length < 2) {
    return {
      name: formattedName, 
      state: null,
    };
  }
  const state = stateMatches[1];
  const formattedState = state.replace(/\s/ig, "");
  return {
    name: formattedName,
    state: formattedState
  }
}

export function getInitiator(choreographyTask: ChoreographyTask): string {
  return choreographyTask.initiatingParticipantRef.name;
}

export function getRespondent(choreographyTask: ChoreographyTask): string {
  const respondent = choreographyTask.participantRef.find(participant => participant !== choreographyTask.initiatingParticipantRef);
  return respondent ? respondent.name : '';
}

export function getDataObject(choreographyTask: ChoreographyTask): DataObject | null {
  const messages = getMessages(choreographyTask);
  if (!messages || messages.length < 1) {
    return null;
  }
  return getDataObjectFromText(messages[0].name);
}

export function getSucceedingFlowNodes(flowNode: FlowNode): FlowNode[] {
  if (flowNode.outgoing === undefined) {
    return [];
  }
  return flowNode.outgoing.map(sequenceFlow => sequenceFlow.targetRef);
}

export function getPrecedingFlowNodes(flowNode: FlowNode): FlowNode[] {
  if (flowNode.incoming === undefined) {
    return [];
  }
  return flowNode.incoming.map(sequenceFlow => sequenceFlow.sourceRef);
}

export function isTaskForwording(task: ChoreographyTask, tasks: ChoreographyTask[], lifecycle: ObjectLifecycle): boolean {
  const initiator = getInitiator(task);
  const respondent = getRespondent(task);
  
  const dataObject = getDataObject(task);

  if (!dataObject) {
    throw new Error(`Data object not found in task ${task.name}`);
  }

  const lifecycleTransitions = lifecycle.transitions
    .filter(transition => transition.to === dataObject.state && transition.participant === initiator) 

  if (lifecycleTransitions.length === 0) {
    console.info(`Task ${task.id} forwards data as no lifecycle transition could be detected`);
    return true;
  } 

  const alternativeTasks = tasks
    .filter(t => t.id !== task.id && 
      getDataObject(t) !== null && 
      getDataObject(t)?.name === dataObject.name && 
      getDataObject(t)?.state === dataObject.state &&
      (getInitiator(t) !== initiator || getRespondent(t) !== respondent) &&
      lifecycle.transitions
        .find(at => at.participant === getInitiator(t) && 
        at.to === dataObject.state));
  
  if (alternativeTasks.length > 0) {
    console.info(`Task ${task.id} may forward data as alternative tasks ${alternativeTasks.map(at => at.name).join(', ')} are found`);
    return true;
  }

  return false;    
}

export function getMessageNameFromTask(task: ChoreographyTask) {
  const dataObject = getDataObject(task);
  if (!dataObject) {
    throw new Error(`Data object not found in task ${task.name}`);
  }
  return `${dataObject.name}_${dataObject.state}`;
}

function getTaskPathToCurrentNodeRec(flowNode: FlowNode, path: ChoreographyTask[], visited: Set<FlowNode>): ChoreographyTask[] {
  if (visited.has(flowNode)) {
    return [];
  }

  if (visited.size > 0 && flowNode.$type === 'bpmn:ChoreographyTask') {
    path.push(flowNode as ChoreographyTask);
  }
 
  visited.add(flowNode);

  const precedingFlowNodes = getPrecedingFlowNodes(flowNode);
  if (precedingFlowNodes.length === 0) {
    return path;
  }

  for (const precedingFlowNode of precedingFlowNodes) {
    const result = getTaskPathToCurrentNodeRec(precedingFlowNode, path, visited);
    if (result.length > 0) {
      return result;
    }
  }

  if (flowNode.$type === 'bpmn:ChoreographyTask') {
    path.pop();
  }

  return [];
}

export function getTaskPathToCurrentNode(flowNode: FlowNode): ChoreographyTask[] {
  return getTaskPathToCurrentNodeRec(flowNode, [], new Set());
}

export function setsAreEqual(xs: Set<any>, ys: Set<any>): boolean {
    return xs.size === ys.size && [...xs].every((x) => ys.has(x));
}

export function jsonToBSPL(protocol: Protocol): string {
 return `
${protocol.name} {
  roles ${protocol.roles.join(', ')}
  parameters ${[
    ...protocol.ins.map(param => `in ${param}${protocol.keys.includes(param) ? ' key' : ''}`), 
    ...protocol.outs.map(param => `out ${param}${protocol.keys.includes(param) ? ' key' : ''}`)
  ].join(', ')}
  ${protocol.privates && protocol.privates.length > 0 ? `private ${protocol.privates.join(', ')}\n` : ''}
  ${protocol.messages.map(message => formatMessage(message)).sort().join('\n  ')}
}`;
}

function formatMessage(message: MessageSchema): string {
  return`${message.from} -> ${message.to}: ${message.name} [${[
      ...message.ins.map(param => `in ${param}`).sort(), 
      ...message.outs.map(param => `out ${param}`).sort(), 
      ...message.nils.map(param => `nil ${param}`).sort(),
    ].join(', ')}]`;
}

export function jsonBSPLDeduplicateMessages(protocol: Protocol) {
  const deduplicatedMessages = protocol.messages.reduce((acc, message) => {
    const formattedMessage = formatMessage(message);
    if (!acc.find(m => m.id !== message.id && formatMessage(m) === formattedMessage)) {
      return [...acc, message];
    };
    return acc;
  }, [] as MessageSchema[]);

  const resulingProtocol = {...protocol, messages: new Array(...deduplicatedMessages)};
  return resulingProtocol;
}
