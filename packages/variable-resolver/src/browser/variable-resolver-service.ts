/********************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { injectable, inject } from 'inversify';
import { Variable, VariableRegistry, VariableContext } from './variable';

/**
 * The variable resolver service should be used to resolve variables in strings.
 */
@injectable()
export class VariableResolverService {

    protected static VAR_REGEXP = /\$\{(.*?)\}/g;

    constructor(
        @inject(VariableRegistry) protected readonly variableRegistry: VariableRegistry
    ) { }

    /**
     * Resolve the variables in the given string.
     * @returns promise resolved to the provided string with already resolved variables.
     * Never reject.
     */
    async resolve(text: string, context?: VariableContext): Promise<string> {
        const variablesToValues = await this.resolveVariables(this.searchVariables(text), context);
        const resolvedText = text.replace(VariableResolverService.VAR_REGEXP, (match: string, varName: string) => {
            const value = variablesToValues.get(varName);
            return typeof value === 'string' ? value : match;
        });
        return resolvedText;
    }

    /**
     * Resolve the variables in the given string array.
     * @returns promise resolved to the provided string array with already resolved variables.
     * Never reject.
     */
    async resolveArray(arr: string[], context?: VariableContext): Promise<string[]> {
        const result: string[] = [];
        for (let i = 0; i < arr.length; i++) {
            result[i] = await this.resolve(arr[i], context);
        }
        return result;
    }

    /**
     * Finds all variables in the given string.
     */
    protected searchVariables(text: string): Variable[] {
        const variables: Variable[] = [];
        let match;
        while ((match = VariableResolverService.VAR_REGEXP.exec(text)) !== null) {
            const variableName = match[1];
            const variable = this.variableRegistry.getVariable(variableName);
            if (variable) {
                variables.push(variable);
            }
        }
        return variables;
    }

    /**
     * Resolve the given variables.
     * @returns promise resolved to the map of the variable name to its value.
     * Never reject.
     */
    protected async resolveVariables(variables: Variable[], context: VariableContext = {}): Promise<Map<string, string>> {
        const resolvedVariables: Map<string, string> = new Map();
        const promises: Promise<any>[] = []; // tslint:disable-line:no-any
        variables.forEach(variable => {
            if (
                context && variable.contexts && // tslint:disable-next-line:no-any
                variable.contexts.some(ctx => typeof context[ctx as any] === 'undefined')
            ) {
                return; // skip case where variable cannot be resolved
            }
            const promise = Promise.resolve(variable.resolve(context)).then(value => {
                if (typeof value === 'string') {
                    resolvedVariables.set(variable.name, value);
                }
            });
            promises.push(promise);
        });
        await Promise.all(promises);
        return resolvedVariables;
    }
}
