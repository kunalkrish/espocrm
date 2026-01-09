/************************************************************************
 * This file is part of EspoCRM.
 *
 * EspoCRM – Open Source CRM application.
 * Copyright (C) 2014-2025 EspoCRM, Inc.
 * Website: https://www.espocrm.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * The interactive user interfaces in modified source and object code versions
 * of this program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU Affero General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU Affero General Public License version 3,
 * these Appropriate Legal Notices must retain the display of the "EspoCRM" word.
 ************************************************************************/

import BaseDashletView from 'views/dashlets/abstract/base';
import MultiCollection from 'multi-collection';
import RecordModalHelper from 'helpers/record-modal';

class ActivitiesDashletView extends BaseDashletView {

    name = 'Activities'

    // language=Handlebars
    templateContent = '<div class="list-container">{{{list}}}</div>'

    rowActionsView = 'crm:views/record/row-actions/activities-dashlet'

    currentStatusFilter = null

    defaultListLayout = {
        rows: [
            [
                {
                    name: 'ico',
                    view: 'crm:views/fields/ico',
                    params: {
                        notRelationship: true,
                    },
                },
                {
                    name: 'name',
                    link: true,
                },
            ],
            [
                {
                    name: 'dateStart',
                    soft: true
                },
                {
                    name: 'parent',
                },
            ],
        ],
    }

    listLayoutEntityTypeMap = {
        Task: {
            rows: [
                [
                    {
                        name: 'ico',
                        view: 'crm:views/fields/ico',
                        params: {
                            notRelationship: true
                        },
                    },
                    {
                        name: 'name',
                        link: true,
                    },
                ],
                [
                    {
                        name: 'status',
                    },
                    {
                        name: 'dateEnd',
                        soft: true
                    },
                    {
                        name: 'priority',
                        view: 'crm:views/task/fields/priority-for-dashlet',
                    },
                    {
                        name: 'parent',
                    },
                ],
            ]
        }
    }

    setup() {
        this.seeds = {};

        this.scopeList = this.getOption('enabledScopeList') || [];

        this.listLayout = {};

        this.scopeList.forEach((item) => {
            if (item in this.listLayoutEntityTypeMap) {
                this.listLayout[item] = this.listLayoutEntityTypeMap[item];

                return;
            }

            this.listLayout[item] = this.defaultListLayout;
        });

        this.wait(true);
        let i = 0;

        this.scopeList.forEach(scope => {
            this.getModelFactory().create(scope, seed => {
                this.seeds[scope] = seed;

                i++;

                if (i === this.scopeList.length) {
                    this.wait(false);
                }
            });
        });

        this.scopeList.slice(0).reverse().forEach(scope => {
            if (this.getAcl().checkScope(scope, 'create')) {
                this.actionList.unshift({
                    name: 'createActivity',
                    text: this.translate('Create ' + scope, 'labels', scope),
                    iconHtml: '<span class="fas fa-plus"></span>',
                    url: '#' + scope + '/create',
                    data: {
                        scope: scope,
                    },
                });
            }
        });

        // Initialize currentStatusFilter from stored options
        this.currentStatusFilter = this.getOption('statusFilter') || 'all';

        // Add status filter actions to the actionList
        this.addStatusFilterActions();
    }

    /**
     * Add status filter actions to the 3-dot menu
     */
    addStatusFilterActions() {
        // Add 'All' filter option
        this.actionList.push({
            name: 'filterStatus',
            text: this.translate('All', 'labels', 'ActivitiesFilter'),
            iconHtml: '<span class="fas fa-filter"></span>',
            data: {
                status: 'all',
                scope: 'all',
            },
            groupIndex: 0,
        });

        // Add status filter options for each entity type
        this.scopeList.forEach((scope, scopeIndex) => {
            const statusOptions = this.getMetadata().get(['entityDefs', scope, 'fields', 'status', 'options']) || [];

            statusOptions.forEach(status => {
                const statusText = this.translate(status, 'options', scope);
                const translatedScope = this.translate(scope, 'scopeNames');

                this.actionList.push({
                    name: 'filterStatus',
                    text: statusText + ' (' + translatedScope + ')',
                    iconHtml: '<span class="fas fa-filter"></span>',
                    data: {
                        status: status,
                        scope: scope,
                    },
                    groupIndex: scopeIndex + 1,
                });
            });
        });

        // Update action menu items with active state
        this.updateFilterActions();
    }

    /**
     * Update filter actions to show active state
     */
    updateFilterActions() {
        const currentFilter = this.currentStatusFilter || 'all';
        const currentScope = this.getOption('statusFilterScope') || 'all';

        this.actionList.forEach(action => {
            if (action.name === 'filterStatus') {
                const isActive = action.data.status === currentFilter && action.data.scope === currentScope;
                action.html = isActive ? '<strong>' + action.text + '</strong>' : null;
            }
        });
    }

    afterRender() {
        this.collection = new MultiCollection();
        this.collection.seeds = this.seeds;
        this.collection.url = 'Activities/upcoming';
        this.collection.maxSize = this.getOption('displayRecords') ||
            this.getConfig().get('recordsPerPageSmall') || 5;
        this.collection.data.entityTypeList = this.scopeList;
        this.collection.data.futureDays = this.getOption('futureDays');

        // Apply status filter to collection
        const statusFilter = this.getOption('statusFilter') || 'all';
        const statusFilterScope = this.getOption('statusFilterScope') || 'all';

        if (statusFilter !== 'all') {
            this.collection.data.status = statusFilter;
            this.collection.data.statusScope = statusFilterScope;
        }

        if (this.getOption('includeShared')) {
            this.collection.data.includeShared = true;
        }

        this.listenToOnce(this.collection, 'sync', () => {
            this.createView('list', 'crm:views/record/list-activities-dashlet', {
                selector: '> .list-container',
                pagination: false,
                type: 'list',
                rowActionsView: this.rowActionsView,
                checkboxes: false,
                collection: this.collection,
                listLayout: this.listLayout,
            }, view => {
                view.render();
            });
        });

        this.collection.fetch();
    }

    actionRefresh() {
        this.refreshInternal();
    }

    // noinspection JSUnusedGlobalSymbols
    actionFilterStatus(data) {
        const status = data.status;
        const scope = data.scope;

        // Update current filter state
        this.currentStatusFilter = status;

        // Store filter in dashlet options for persistence
        this.setOption('statusFilter', status);
        this.setOption('statusFilterScope', scope);

        // Update action menu items to show active state
        this.updateFilterActions();

        // Refresh the collection with new filter
        if (this.collection) {
            if (status === 'all') {
                delete this.collection.data.status;
                delete this.collection.data.statusScope;
            } else {
                this.collection.data.status = status;
                this.collection.data.statusScope = scope;
            }

            this.collection.fetch();
        }
    }

    autoRefresh() {
        this.refreshInternal({skipNotify: true});
    }

    /**
     * @private
     * @param {{skipNotify?: boolean}} [options]
     * @return {Promise<void>}
     */
    async refreshInternal(options = {}) {
        if (!options.skipNotify) {
            Espo.Ui.notifyWait();
        }

        await this.collection.fetch({
            previousTotal: this.collection.total,
            previousDataList: this.collection.models.map(model => {
                return Espo.Utils.cloneDeep(model.attributes);
            }),
        });

        if (!options.skipNotify) {
            Espo.Ui.notify();
        }
    }

    // noinspection JSUnusedGlobalSymbols
    actionCreateActivity(data) {
        const scope = data.scope;
        const attributes = {};

        this.populateAttributesAssignedUser(scope, attributes);

        const helper = new RecordModalHelper();

        helper.showCreate(this, {
            entityType: scope,
            attributes: attributes,
            afterSave: () => {
                this.actionRefresh();
            },
        });
    }

    // noinspection JSUnusedGlobalSymbols
    actionCreateMeeting() {
        const attributes = {};

        this.populateAttributesAssignedUser('Meeting', attributes);

        const helper = new RecordModalHelper();

        helper.showCreate(this, {
            entityType: 'Meeting',
            attributes: attributes,
            afterSave: () => {
                this.actionRefresh();
            },
        });
    }

    // noinspection JSUnusedGlobalSymbols
    actionCreateCall() {
        const attributes = {};

        this.populateAttributesAssignedUser('Call', attributes);

        const helper = new RecordModalHelper();

        helper.showCreate(this, {
            entityType: 'Call',
            attributes: attributes,
            afterSave: () => {
                this.actionRefresh();
            },
        });
    }

    populateAttributesAssignedUser(scope, attributes) {
        if (this.getMetadata().get(['entityDefs', scope, 'fields', 'assignedUsers'])) {
            attributes['assignedUsersIds'] = [this.getUser().id];
            attributes['assignedUsersNames'] = {};
            attributes['assignedUsersNames'][this.getUser().id] = this.getUser().get('name');
        } else {
            attributes['assignedUserId'] = this.getUser().id;
            attributes['assignedUserName'] = this.getUser().get('name');
        }
    }
}

export default ActivitiesDashletView;
