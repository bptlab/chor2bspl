import { ChoreographyTask, FlowNode } from "bpmn-moddle";
import { parse } from "../parser";
import { is } from "../helper";

function calculateTraces(node: FlowNode, currentPath: FlowNode[], allTraces: FlowNode[][]): void {
  currentPath.push(node);

  if (node.$type === 'bpmn:EndEvent') {
    allTraces.push([...currentPath]);
  }

  if (node.outgoing && node.outgoing.length > 0) {
    for (const outgoingFlow of node.outgoing) {
      const target = outgoingFlow.targetRef
      calculateTraces(target, currentPath, allTraces);
    }
  }

  currentPath.pop();
}

// Does not support parallel gateways yet
export async function getChorInteractionSequences(bpmn: string): Promise<ChoreographyTask[][]> {
  const { startEvents } = await parse(bpmn);
  if (startEvents.length === 0) {
    console.error('Found no start event.');
    return [];
  }
  if (startEvents.length > 1) {
    console.error('Found multiple start events. Only the first one will be considered.');
  }
  const startEvent = startEvents[0];

  const allTraces: FlowNode[][] = [];
  console.log('Calculating bpmn interaction sequences...');
  calculateTraces(startEvent, [], allTraces);
  console.log('Calculated bpmn interaction sequences.');

  return allTraces.map(trace => trace.filter(is('bpmn:ChoreographyTask')) as ChoreographyTask[]);
}
