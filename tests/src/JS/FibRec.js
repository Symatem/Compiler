function(program) {
    const [fibRecOperator, fibRecOperations] = program.createOperator(2),
          [thenOperator, thenOperations] = program.createOperator(0),
          [elseOperator, elseOperations] = program.createOperator(5);

    program.backend.setData(fibRecOperator, 'FibRec');
    program.createCarrier(fibRecOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.LessThan);
    program.createCarrier(fibRecOperations[0], program.backend.symbolByName.Input, fibRecOperator, program.backend.symbolByName.Input);
    program.createCarrier(fibRecOperations[0], program.backend.symbolByName.Comparand, program.backend.symbolByName.Two);
    program.createCarrier(fibRecOperations[1], program.backend.symbolByName.Operator, program.backend.symbolByName.If);
    program.createCarrier(fibRecOperations[1], program.backend.symbolByName.Condition, fibRecOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(fibRecOperations[1], program.backend.symbolByName.Then, thenOperator);
    program.createCarrier(fibRecOperations[1], program.backend.symbolByName.Else, elseOperator);
    program.createCarrier(fibRecOperations[1], program.backend.symbolByName.Input, fibRecOperator, program.backend.symbolByName.Input);
    program.createCarrier(fibRecOperator, program.backend.symbolByName.Output, fibRecOperations[1], program.backend.symbolByName.Output);

    program.backend.setData(thenOperator, 'FibRecThen');
    program.createCarrier(thenOperator, program.backend.symbolByName.Output, thenOperator, program.backend.symbolByName.Input);

    program.backend.setData(elseOperator, 'FibRecElse');
    program.createCarrier(elseOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.Subtraction);
    program.createCarrier(elseOperations[0], program.backend.symbolByName.Minuend, elseOperator, program.backend.symbolByName.Input);
    program.createCarrier(elseOperations[0], program.backend.symbolByName.Subtrahend, program.backend.symbolByName.Two);
    program.createCarrier(elseOperations[1], program.backend.symbolByName.Operator, program.backend.symbolByName.Subtraction);
    program.createCarrier(elseOperations[1], program.backend.symbolByName.Minuend, elseOperator, program.backend.symbolByName.Input);
    program.createCarrier(elseOperations[1], program.backend.symbolByName.Subtrahend, program.backend.symbolByName.One);
    program.createCarrier(elseOperations[2], program.backend.symbolByName.Operator, fibRecOperator);
    program.createCarrier(elseOperations[2], program.backend.symbolByName.Input, elseOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(elseOperations[3], program.backend.symbolByName.Operator, fibRecOperator);
    program.createCarrier(elseOperations[3], program.backend.symbolByName.Input, elseOperations[1], program.backend.symbolByName.Output);
    program.createCarrier(elseOperations[4], program.backend.symbolByName.Operator, program.backend.symbolByName.Addition);
    program.createCarrier(elseOperations[4], program.backend.symbolByName.Input, elseOperations[2], program.backend.symbolByName.Output);
    program.createCarrier(elseOperations[4], program.backend.symbolByName.OtherInput, elseOperations[3], program.backend.symbolByName.Output);
    program.createCarrier(elseOperator, program.backend.symbolByName.Output, elseOperations[4], program.backend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(program.backend.symbolByName.Operator, fibRecOperator);
    inputs.set(program.backend.symbolByName.Input, program.backend.symbolByName.Natural32);
    return inputs;
}
