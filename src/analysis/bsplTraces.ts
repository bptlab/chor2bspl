import { MessageSchema, Protocol } from './translator';

interface State {
  participants: {
    [key: string]: Set<string>;
  }
  sequence: MessageSchema[];
}

function canSendMessage(state: State, message: MessageSchema): boolean {
  const senderState = state.participants[message.from] as Set<string>;

  for (const nil of message.nils) {
    if (senderState.has(nil)) return false;
  }
  for (const out of message.outs) {
    if (senderState.has(out)) return false;
  }
  for (const input of message.ins) {
    if (!senderState.has(input)) return false;
  }
  return true;
}

function deepCopyState(state: State): State {
  const newParticipants: { [key: string]: Set<string> } = {};
  for (const key in state.participants) {
    newParticipants[key] = new Set(state.participants[key]);
  }
  return {
    participants: newParticipants,
    sequence: [...state.sequence]
  };
}

function getAllInteractionSequences(protocol: Protocol, state: State, traces: MessageSchema[][]): void {
  let hasNext = false;

  protocol.messages.forEach(message => {
    if (canSendMessage(state, message)) {
      hasNext = true;

      // Create a deep copy of the current state
      const newState = deepCopyState(state);
      newState.sequence.push(message);

      // Update the state of the sender and receiver with ins and outs
      for (const param of [...message.ins, ...message.outs]) {
        (newState.participants[message.from] as Set<string>).add(param);
        (newState.participants[message.to] as Set<string>).add(param);
      }

      getAllInteractionSequences(protocol, newState, traces);
    } 
  });

  if (!hasNext) {
    traces.push(state.sequence);
  }
}

export function getBsplInteractionSequences(protocol: Protocol): MessageSchema[][] {
  const initialState: State = {
    participants: {},
    sequence: []
  };

  protocol.roles.forEach(role => {
    initialState.participants[role] = new Set();
  });

  const interactionSequences: MessageSchema[][] = [];
  console.log("Calculating bspl interaction sequences...");
  getAllInteractionSequences(protocol, initialState, interactionSequences);
  console.log("Calculated bspl interaction sequences.");

  return interactionSequences;
}
