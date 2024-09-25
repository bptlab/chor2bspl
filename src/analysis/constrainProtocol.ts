import { Protocol } from "./translator";
import { Constraint } from "./findConstraints";

export function constrainProtocol(bspl: Protocol, constraints: Constraint[]): Protocol {

  const reducedConstraints = constraints
    .reduce((acc: Constraint[], constraint) => {
      if (acc.find(c => c.type === "exclusive" && c.fromMessageId === constraint.toMessageId && c.toMessageId === constraint.fromMessageId) === undefined) {
        return acc.concat(constraint);
      }
      return acc;
    }, []);

  const exclusiveConstraints = reducedConstraints.filter(c => c.type === "exclusive");
  const precedesConstraints = reducedConstraints.filter(c => c.type === "precedes").reduce((acc: Constraint[][], c) => {
    const exclusivePrecedes = acc.find(pc => pc.find(cc => cc.fromTaskId !== c.fromTaskId && cc.toTaskId === c.toTaskId))
    if (exclusivePrecedes) {
      exclusivePrecedes.push(c);
    } else {
      acc.push([c]);
    }
    return acc;
  }, []);

  exclusiveConstraints.forEach((constraint, index) => {
    const fromMessages = bspl.messages.filter(m => m.taskId === constraint.fromTaskId);
    if (!fromMessages) {
      throw new Error(`Could not find "from" messages for task id ${constraint.fromTaskId}`);
    }
    const toMessages = bspl.messages.filter(m => m.taskId === constraint.toTaskId);
    if (!toMessages) {
      throw new Error(`Could not find "to" messages for task id ${constraint.toTaskId}`);
    }

    const constraintParameterName = `cf_e${index}`;
    bspl.privates.push(constraintParameterName);
    fromMessages.forEach(fromMessage => {
      fromMessage.parameters.push(constraintParameterName);
      fromMessage.outs.push(constraintParameterName);
    });
    toMessages.forEach(toMessage => {
      toMessage.parameters.push(constraintParameterName);
      toMessage.outs.push(constraintParameterName);
    });
  });

  precedesConstraints.forEach((constraints, groupIndex) => {
    const targetTaskId = constraints[0].toTaskId;
    const toMessages = bspl.messages.filter(m => m.taskId === targetTaskId);
    bspl.messages = new Array(...bspl.messages.filter(m => m.taskId !== targetTaskId));

    constraints.forEach((constraint, index) => {
      const fromMessages = bspl.messages.filter(m => m.taskId === constraint.fromTaskId);
      if (!fromMessages) {
        throw new Error(`Could not find "from" messages for task id ${constraint.fromTaskId}`);
      }
      const constraintParameterName = `cf_p${groupIndex}_${index}`;
      bspl.privates.push(constraintParameterName);
      fromMessages.forEach(fromMessage => {
        fromMessage.parameters = [...new Set([...fromMessage.parameters, constraintParameterName])];
        fromMessage.outs = [...new Set([...fromMessage.outs, constraintParameterName])];
      });

      const newToMessages = toMessages.map(m => ({
        ...m, 
        ins: [...m.ins, constraintParameterName], 
        parameters: [...m.parameters, constraintParameterName]
      }));
  
      bspl.messages.push(...newToMessages);
    })
  })

  return bspl;
}
