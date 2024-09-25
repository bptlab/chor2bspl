import BPMNModdle, { BaseElement, Choreography, ChoreographyTask, StartEvent } from 'bpmn-moddle';
import { is } from './helper';

export interface ChoreographyData {
  name: string;
  tasks: ChoreographyTask[];
  startEvents: StartEvent[];
  participants: string[];
}

export async function parse(xml: string): Promise<ChoreographyData> {
  console.info('Parsing BPMN file...');
  const moddle = new BPMNModdle()
  const result: any = await moddle.fromXML(xml);

  const choreographies = result.rootElement.rootElements.filter((element: BaseElement) => element.$type === 'bpmn:Choreography') as Choreography[];

  if (choreographies.length === 0) {
    throw new Error('Could not find choreography definitions.');
  }

  if (choreographies.length > 1) {
    console.error('Found multiple choreography definitions. Only the first one will be considered.');
  }

  const choreography = choreographies[0];
  const participants = choreography.participants;
  const tasks = choreography.flowElements.filter(is('bpmn:ChoreographyTask')) as ChoreographyTask[];
  const startEvents = choreography.flowElements.filter(is('bpmn:StartEvent')) as StartEvent[];

  console.info('Parsed BPMN file');
  return {
    name: choreography.name || 'Choreography',
    tasks,
    startEvents,
    participants: participants.map(participant => participant.name),
  }
}
