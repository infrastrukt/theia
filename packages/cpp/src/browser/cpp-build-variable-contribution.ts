/********************************************************************************
 * Copyright (C) 2018 Ericsson and others.
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
import { QuickOpenService, QuickOpenGroupItem, QuickOpenGroupItemOptions, QuickOpenMode } from '@theia/core/lib/browser';
import { VariableContribution, VariableRegistry } from '@theia/variable-resolver/lib/browser';
// import { CppBuildConfiguration } from './cpp-build-configurations';
import { CppBuildManager } from './cpp-build-manager';
import { CppTaskContext } from './cpp-task-provider';

@injectable()
export class CppBuildVariableContribution implements VariableContribution {

    @inject(QuickOpenService) protected readonly quickOpenService: QuickOpenService;
    @inject(CppBuildManager) protected readonly cppBuildManager: CppBuildManager;

    registerVariables(registry: VariableRegistry) {
        registry.registerVariable({
            name: 'cpp.build.target',
            description: 'Build target to use when building a C/C++ project',
            contexts: [CppTaskContext],

            resolve: async context => {
                const cppContext: CppTaskContext = context[CppTaskContext];
                const config = cppContext.buildConfiguration;

                // if the target is already specified, do not ask
                if (typeof cppContext.buildTarget === 'string') {
                    return cppContext.buildTarget;
                }

                const targets = await this.cppBuildManager.getTargets(config);
                return new Promise<string>((resolve, reject) => {
                    this.quickOpenService.open(
                        {
                            onType: (lookFor: string, acceptor) => {
                                const input = lookFor.trim();
                                const inputItem = [];

                                if (input) {
                                    inputItem.push(new QuickOpenGroupItem(<QuickOpenGroupItemOptions>{
                                        groupLabel: 'Input',
                                        label: input,
                                        run: mode => {
                                            if (mode !== QuickOpenMode.OPEN) {
                                                return false;
                                            }
                                            resolve(input);
                                            return true;
                                        }
                                    }));
                                }

                                const targetItems = targets.map(target => new QuickOpenGroupItem(<QuickOpenGroupItemOptions>{
                                    label: target,
                                    run: mode => {
                                        if (mode !== QuickOpenMode.OPEN) {
                                            return false;
                                        }
                                        resolve(target);
                                        return true;
                                    },
                                }));

                                const firstTarget = targetItems[0];
                                if (firstTarget) {
                                    const options = firstTarget['options'];
                                    options.groupLabel = 'Available Targets';
                                    options.showBorder = true;
                                }

                                acceptor(([] as QuickOpenGroupItem[]).concat(inputItem, targetItems));
                            }
                        }, {
                            placeholder: 'Enter the target to build...',
                            onClose: cancelled => cancelled ? reject('Abort') : undefined,
                            fuzzyMatchLabel: true,
                        }
                    );
                });
            },
        });
    }
}
