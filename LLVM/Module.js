export class LLVMModule {
    constructor(identity, functions = [], aliases = []) {
        this.identity = identity;
        this.functions = functions;
        this.aliases = aliases;
    }

    serialize() {
        const parts = [];
        for(const func of this.functions)
            parts.push(func.serializeDeclaration());
        for(const alias of this.aliases)
            parts.push(alias.serializeDeclaration());
        if(this.identity) {
            parts.push('!llvm.ident = !{!0}');
            parts.push(`!0 = !{!"${this.identity}"}`);
        }
        return parts.join('\n');
    }
}
