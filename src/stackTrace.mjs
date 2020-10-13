export function log(context, symbols, message) {
    function symbolToText(symbol) {
        const data = context.backend.getData(symbol);
        return (data != undefined) ? data : '('+symbol+')';
    }
    const symbolsToText = [];
    if(symbols instanceof Map)
        for(const [key, value] of symbols)
            symbolsToText.push(symbolToText(key)+'='+symbolToText(value));
    else if(symbols instanceof Array || symbols instanceof Set)
        for(const element of symbols)
            symbolsToText.push(symbolToText(element));
    else
        symbolsToText.push(symbolToText(symbols));
    context.logMessages.push('  '.repeat(context.stackHeight)+message+': '+symbolsToText.join(', '));
}

export function throwError(context, symbols, message) {
    log(context, symbols, 'ERROR: '+message);
    throw new Error(message);
}

export function throwWarning(context, symbols, message) {
    log(context, symbols, 'WARNING: '+message);
}

export function pushStackFrame(context, entry, message) {
    log(context, entry.symbol, message);
    ++context.stackHeight;
}

export function popStackFrame(context, entry, message) {
    log(context, entry.symbol, message);
    --context.stackHeight;
}
