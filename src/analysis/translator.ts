import { ChoreographyTask } from 'bpmn-moddle';
import { getClassDependencies, getDataObject, getInitiator, getMessageNameFromTask, getRespondent, getTaskPathToCurrentNode, isTaskForwording } from '../helper';

export interface DataObject {
  name: string,
  state: string | null,
}

export interface MessageSchema {
  id: number;
  name: string;
  type: string;
  parameters: string[];
  keys: string[];
  ins: string[];
  outs: string[];
  nils: string[];
  roles: string[];
  to: string;
  from: string;
  taskId: string;
}

export interface Protocol {
  name: string;
  type: string;
  parameters: string[];
  keys: string[];
  ins: string[];
  outs: string[];
  nils: string[];
  privates: string[];
  roles: string[];
  messages: MessageSchema[];
}

export interface DataClass {
  attributes: string[];
  keys: string[];
  relations: {
    class: string,
    lowerBound: number,
    upperBound: number,
  }[];
}

export interface DataModel {
  [id: string]: DataClass;
}

export interface ObjectLifecycle {
  states: {
    name: string,
    attributes: string[]
  }[],
  transitions: {
    from: string | null,
    to: string,
    participant: string
  }[]
}

export interface ObjectLifecycles {
  [id: string]: ObjectLifecycle
}

function subtractList(listA: string[], listB: string[]) {
  return listA.filter(value => !listB.includes(value));
}

export function translateToBSPL(
  name: string,
  tasks: ChoreographyTask[],
  roles: string[],
  dataModel: DataModel,
  lifecycles: ObjectLifecycles,
): Protocol {
  const protocolParameters = Object.keys(dataModel).flatMap(key => dataModel[key].attributes);
  const protocolKeys = Object.keys(dataModel).flatMap(key => dataModel[key].keys);
  const protocolOuts = protocolParameters;
  const protocolIns: string[] = [];
  const protocolNils: string[] = [];
  const protocolPrivates: string[] = []; // This array is filled when parsing the messages

  let currentMessageId = 0;

  const messages: MessageSchema[] = tasks.flatMap(task => {
    const initiator = getInitiator(task);
    const respondent = getRespondent(task);
    const dataObject = getDataObject(task);
    const name = getMessageNameFromTask(task);

    if (!dataObject) {
      throw new Error(`Data object not found in task ${task.id}`);
    }

    const dataClass = dataModel[dataObject.name];

    if (!dataClass) {
      throw new Error(`Data object ${dataObject.name} not found in data model`);
    }

    const lifecycle = lifecycles[dataObject.name];
    const lifecycleState = lifecycle.states.find(state => state.name === dataObject.state);

    if (!lifecycleState || lifecycleState.attributes.length === 0) {
      throw new Error(`Could not find attributes for state ${dataObject.state} in lifecycle ${dataObject.name}`);
    }

    const transitionsToState = lifecycle.transitions
      .filter(transition => transition.to === dataObject.state);

    const praticipantTransitionsToState = transitionsToState
      .filter(transition => transition.participant === initiator);

    const keyParameters = dataClass.keys;
    const stateParameters = subtractList(lifecycleState.attributes, keyParameters);

    const messageSchemas: MessageSchema[] = praticipantTransitionsToState.map(participantTransition => {
      const ins: string[] = [];
      const outs: string[] = stateParameters;
      const nils: string[] = [];
      const keys: string[] = keyParameters;

      const createsDataObject = participantTransition.from === null;

      if (createsDataObject) {
        outs.push(...keyParameters);

        // Dependencies
        const relatedKeyParameters = getClassDependencies(dataClass, dataModel)
          .flatMap(relatedClass => relatedClass.keys);
        ins.push(...relatedKeyParameters);
        if (relatedKeyParameters.length === 0) {
        } else {
        }
      } else {
        ins.push(...keyParameters);

        // Previous State
        const previousState = lifecycle.states.find(state => state.name === participantTransition.from);
        if (!previousState) {
          throw new Error(`Could not find state ${participantTransition.from} previous to ${participantTransition.to} in lifecycle ${dataObject.name}`);
        }
        const previousStateParameters = subtractList(previousState.attributes, keyParameters);
        ins.push(...previousStateParameters);

        // Alternative transitions
        const alternativeTransitions = lifecycle.transitions
          .filter(altTransition => altTransition.from === participantTransition.from &&
            altTransition.to !== participantTransition.to);

        alternativeTransitions.forEach(altTransition => {
          const altState = lifecycle.states.find(state => state.name === altTransition.to);
          if (!altState) {
            throw new Error(`State ${altTransition.to} not found in lifecycle ${dataObject.name}`);
          }
          nils.push(...subtractList(altState.attributes, keyParameters));
        });
      }

      return {
        id: currentMessageId++,
        name,
        type: 'message',
        roles: [initiator, respondent],
        from: initiator,
        to: respondent,
        parameters: [... new Set([...ins, ...outs, ...nils])],
        ins: [... new Set(ins)],
        outs: [... new Set(outs)],
        nils: [... new Set(nils)],
        keys: [... new Set(keys)],
        taskId: task.id,
      }
    });

    if (isTaskForwording(task, tasks, lifecycle)) {
      const privateParameter = `fw_${ initiator }_${ respondent }_${ dataObject.name }_${ dataObject.state }`;
      protocolPrivates.push(privateParameter);
      
      const ins = [...stateParameters, ...keyParameters];
      const outs = [privateParameter];

      const potentialNextStates = lifecycle.states
        .filter(state => lifecycle.transitions
          .some(transition => transition.from === dataObject.state && transition.to === state.name));

      const nils = potentialNextStates.flatMap(state => subtractList(state.attributes, keyParameters));

      messageSchemas.forEach(message => {
        message.outs.push(privateParameter);
      })

      messageSchemas.push({
        id: currentMessageId++,
        name,
        type: 'message',
        roles: [initiator, respondent],
        from: initiator,
        to: respondent,
        parameters: [... new Set([...ins, ...outs, ...nils])],
        ins: [... new Set(ins)],
        outs: [... new Set(outs)],
        nils:  [... new Set(nils)],
        keys: keyParameters,
        taskId: task.id,
      } as MessageSchema);
    }

    return messageSchemas;
  }).filter(message => message !== null) as MessageSchema[];
  
  const protocol: Protocol = {
    name,
    type: 'protocol',
    parameters: protocolParameters,
    keys: protocolKeys,
    ins: [... new Set(protocolIns)],
    outs: protocolOuts,
    nils: protocolNils,
    privates: [... new Set(protocolPrivates)],
    roles,
    messages,
  }

  return protocol;
}
