function(program) {
    const [gcdRecOperator, gcdRecOperations] = program.createOperator(2),
          [thenOperator, thenOperations] = program.createOperator(0),
          [elseOperator, elseOperations] = program.createOperator(2);

    program.backend.setData(gcdRecOperator, 'GcdRec');
    program.createCarrier(gcdRecOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.Equal);
    program.createCarrier(gcdRecOperations[0], program.backend.symbolByName.Input, gcdRecOperator, program.backend.symbolByName.OtherInput);
    program.createCarrier(gcdRecOperations[0], program.backend.symbolByName.Comparand, program.backend.symbolByName.Zero);
    program.createCarrier(gcdRecOperations[1], program.backend.symbolByName.Operator, program.backend.symbolByName.If);
    program.createCarrier(gcdRecOperations[1], program.backend.symbolByName.Condition, gcdRecOperations[0], program.backend.symbolByName.Output);
    program.createCarrier(gcdRecOperations[1], program.backend.symbolByName.Then, thenOperator);
    program.createCarrier(gcdRecOperations[1], program.backend.symbolByName.Else, elseOperator);
    program.createCarrier(gcdRecOperations[1], program.backend.symbolByName.Input, gcdRecOperator, program.backend.symbolByName.Input);
    program.createCarrier(gcdRecOperations[1], program.backend.symbolByName.OtherInput, gcdRecOperator, program.backend.symbolByName.OtherInput);
    program.createCarrier(gcdRecOperator, program.backend.symbolByName.Output, gcdRecOperations[1], program.backend.symbolByName.Output);

    program.backend.setData(thenOperator, 'GcdRecThen');
    program.createCarrier(thenOperator, program.backend.symbolByName.Output, thenOperator, program.backend.symbolByName.Input);

    program.backend.setData(elseOperator, 'GcdRecElse');
    program.createCarrier(elseOperations[0], program.backend.symbolByName.Operator, program.backend.symbolByName.Division);
    program.createCarrier(elseOperations[0], program.backend.symbolByName.Dividend, elseOperator, program.backend.symbolByName.Input);
    program.createCarrier(elseOperations[0], program.backend.symbolByName.Divisor, elseOperator, program.backend.symbolByName.OtherInput);
    program.createCarrier(elseOperations[1], program.backend.symbolByName.Operator, gcdRecOperator);
    program.createCarrier(elseOperations[1], program.backend.symbolByName.Input, elseOperator, program.backend.symbolByName.OtherInput);
    program.createCarrier(elseOperations[1], program.backend.symbolByName.OtherInput, elseOperations[0], program.backend.symbolByName.Rest);
    program.createCarrier(elseOperator, program.backend.symbolByName.Output, elseOperations[1], program.backend.symbolByName.Output);

    const inputs = new Map();
    inputs.set(program.backend.symbolByName.Operator, gcdRecOperator);
    inputs.set(program.backend.symbolByName.Input, program.backend.symbolByName.Natural32);
    inputs.set(program.backend.symbolByName.OtherInput, program.backend.symbolByName.Natural32);
    return inputs;
}
