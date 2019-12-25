// Copyright (c) 2019, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

"use strict";

var
    $ = require('jquery'),
    _ = require('underscore'),
    monaco = require('monaco-editor'),
    ga = require('analytics'),
    history = require('./history');

function HistoryDiffState(model) {
    this.model = model;
    this.result = null;
}

HistoryDiffState.prototype.update = function (result) {
    this.result = result;
    this.refresh();

    return true;
};

HistoryDiffState.prototype.refresh = function () {
    var output = this.result || [];
    this.model.setValue(output.join("\n/******************************/\n"));
};

function History() {
    this.modal = null;
    this.diffEditor = null;
    this.lhs = null;
    this.rhs = null;
    this.currentList = [];
}

History.prototype.initializeIfNeeded = function () {
    if (this.modal === null) {
        this.modal = $("#history");

        this.diffEditor = monaco.editor.createDiffEditor(this.modal.find(".monaco-placeholder")[0], {
            fontFamily: 'Consolas, "Liberation Mono", Courier, monospace',
            scrollBeyondLastLine: false,
            readOnly: true,
            language: 'c++',
            minimap: {
                enabled: true
            }
        });
        this.lhs = new HistoryDiffState(monaco.editor.createModel('', 'c++'));
        this.rhs = new HistoryDiffState(monaco.editor.createModel('', 'c++'));
        this.diffEditor.setModel({ original: this.lhs.model, modified: this.rhs.model });

        this.modal.find('#inline-diff-checkbox').click(_.bind(function (event) {
            var inline = $(event.target).prop('checked');
			this.diffEditor.updateOptions({
				renderSideBySide: !inline
			});
        }, this));
    }
};

History.prototype.populateFromLocalStorage = function () {
    this.currentList = history.sortedList();
    this.populate(
        this.modal.find('.historiccode'),
        _.map(this.currentList, _.bind(function (data) {
            var dt = new Date(data.dt);
            return {
                dt: data.dt,
                name: dt.toString().replace(/\s\(.*\)/, ''),
                load: _.bind(function () {
                    this.onLoad(data);
                    this.modal.modal('hide');
                }, this)
            };
        }, this)));
};

History.prototype.HideRadiosAndSetDiff = function () {
    var root = this.modal.find('.historiccode');
    var items = root.find('li:not(.template)');

    var foundbase = false;
    var foundcomp = false;

    items.each(_.bind(function (idx, elem) {
        var li = $(elem);
        var dt = li.data('dt');

        var base = li.find('.base');
        var comp = li.find('.comp');

        var baseShouldBeVisible = true;
        var compShouldBeVisible = true;

        if (comp.prop('checked')) {
            foundcomp = true;
            baseShouldBeVisible = false;

            var itemRight = _.find(this.currentList, function (item) {
                return (item.dt === dt);
            });

            this.rhs.update(itemRight.code);
        } else if (li.find('.base').prop('checked')) {
            foundbase = true;

            var itemLeft = _.find(this.currentList, function (item) {
                return (item.dt === dt);
            });

            this.lhs.update(itemLeft.code);
        }

        if (foundbase && foundcomp) {
            compShouldBeVisible = false;
        } else if (!foundbase && !foundcomp) {
            baseShouldBeVisible = false;
        }

        if (compShouldBeVisible) {
            comp.css('visibility', '');
        } else {
            comp.css('visibility', 'hidden');
        }

        if (baseShouldBeVisible) {
            base.css('visibility', '');
        } else {
            base.css('visibility', 'hidden');
        }
    }, this));
};

History.prototype.populate = function (root, list) {
    root.find('li:not(.template)').remove();
    var template = root.find('.template');

    var baseMarked = false;
    var compMarked = false;

    _.each(list, _.bind(function (elem) {
        var li = template
            .clone()
            .removeClass('template')
            .appendTo(root);

        li.data('dt', elem.dt);

        var base = li.find('.base');
        var comp = li.find('.comp');

        if (!compMarked) {
            comp.prop('checked', 'checked');
            compMarked = true;
        } else if (!baseMarked) {
            base.prop('checked', 'checked');
            baseMarked = true;
        }

        base.click(_.bind(this.HideRadiosAndSetDiff, this));
        comp.click(_.bind(this.HideRadiosAndSetDiff, this));

        li.find('a').text(elem.name).click(elem.load);
    }, this));

    this.HideRadiosAndSetDiff();
};

History.prototype.run = function (onLoad) {
    this.initializeIfNeeded();
    this.populateFromLocalStorage();
    this.onLoad = onLoad;
    this.modal.modal();
    ga.proxy('send', {
        hitType: 'event',
        eventCategory: 'OpenModalPane',
        eventAction: 'History'
    });
};

module.exports = {
    History: History
};
