/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const myOptionsManager = new OptionsManager();
const tldStarPattern = /^(.+)\.\*$/;

function RequestRule() {
    return {
        pattern: {
            scheme: "*",
            matchSubDomains: false,
            host: "",
            path: ""
        },
        types: ["main_frame"],
        action: "",
        active: true
    };
}

function RuleInputFactory(rule = new RequestRule()) {
    switch (rule.action) {
        case "filter":
            return new FilterRuleInput(rule);
        case "block":
            return new BlockRuleInput(rule);
        case "redirect":
            return new RedirectRuleInput(rule);
        case "whitelist":
            return new WhitelistRuleInput(rule);
        default:
            return new RuleInput(rule);
    }
}

function FilterRuleInput(rule) {
    RuleInput.call(this, rule);
    this.title = "Filter rule for ";
    this.description = "Filters redirection tracking requests and omits tracking URL parameters.";
    this.optionsPath = "rules";
    this.updateModel();
}
FilterRuleInput.prototype = Object.create(RuleInput.prototype);
FilterRuleInput.prototype.constructor = FilterRuleInput;

function BlockRuleInput(rule) {
    RuleInput.call(this, rule);
    this.title = "Block rule for ";
    this.description = "Cancels requests before they are made.";
    this.optionsPath = "rules";
    this.updateModel();
}
BlockRuleInput.prototype = Object.create(RuleInput.prototype);
BlockRuleInput.prototype.constructor = BlockRuleInput;

function RedirectRuleInput(rule) {
    RuleInput.call(this, rule);
    this.title = "Redirect rule for ";
    this.description = "Redirects requests to self defined redirect URL.";
    this.optionsPath = "rules";
    this.updateModel();
}
RedirectRuleInput.prototype = Object.create(RuleInput.prototype);
RedirectRuleInput.prototype.constructor = RedirectRuleInput;
RedirectRuleInput.prototype.updateModel = function () {
    RuleInput.prototype.updateModel.call(this);
    toggleHidden(false, this.model.qs(".redirectUrl"), this.model.qs(".redirectUrl").parentNode, this.model.qs(".redirectUrlForm"));
    this.model.qs(".redirectUrl").value = this.rule.redirectUrl || "";
};
RedirectRuleInput.prototype.updateRule = function () {
    RuleInput.prototype.updateRule.call(this);
    this.rule.redirectUrl = this.model.qs(".redirectUrl").value;
};

function WhitelistRuleInput(rule) {
    RuleInput.call(this, rule);
    this.title = "Whitelist rule for ";
    this.description = "Disables all other rules and processes requests normally.";
    this.optionsPath = "whitelist";
    this.updateModel();
}
WhitelistRuleInput.prototype = Object.create(RuleInput.prototype);
WhitelistRuleInput.prototype.constructor = WhitelistRuleInput;

function RuleInput(rule) {
    let self = this;
    self.rule = rule;
    self.model = cloneRuleInputModel();
    self.model.qs = self.model.querySelector;
    self.model.qsa = self.model.querySelectorAll;
    self.tldsTagsInput = tagsInput(self.model.qs(".input-tlds"));
    self.title = "Filter rule for ";
    self.description = "Filters redirection tracking requests and omits tracking URL parameters.";
    self.optionsPath = "rules";

    addInputValidation(self.model.qs(".host"), self.setAllowSave.bind(self));
    addInputValidation(self.model.qs(".path"), self.setAllowSave.bind(self));
    addInputValidation(self.model.qs(".redirectUrl"), self.setAllowSave.bind(self));

    self.model.qs(".host").addEventListener("input", self.validateTLDPattern.bind(self));
    self.model.qs(".btn-edit").addEventListener("click", self.toggleEdit.bind(self));
    self.model.qs(".btn-activate").addEventListener("click", self.toggleActive.bind(self));
    self.model.qs(".btn-remove").addEventListener("click", self.remove.bind(self));
    self.model.qs(".btn-save").addEventListener("click", self.save.bind(self));
    self.model.qs(".action").addEventListener("change", self.change.bind(self));

    self.model.qs(".any-url").addEventListener("change", function (e) {
        setButtonChecked(self.model.qs(".any-url"), e.target.checked);
        toggleHidden(e.target.checked, self.model.qs(".host").parentNode, self.model.qs(".path").parentNode, self.model.qs(".pattern"));
        self.validate();
    });

    self.model.qs(".btn-group-types").addEventListener("change", function (e) {
        setButtonChecked(e.target, e.target.checked);
    }, false);

    self.model.qs(".more-types").addEventListener("change", function (e) {
        e.stopPropagation();
        let extraTypes = self.model.qsa(".extra-type:not(:checked)");
        self.model.qs(".more-types").parentNode.querySelector(".text").textContent = self.model.qs(".more-types").checked ? "◂ Less" : "More ▸";
        for (let type of extraTypes) {
            toggleHidden(!self.model.qs(".more-types").checked, type.parentNode);
        }
    }, false);

    self.model.qs(".any-type").addEventListener("change", function (e) {
        setButtonChecked(self.model.qs(".any-type"), e.target.checked);
        toggleHidden(e.target.checked, self.model.qs(".btn-group-types"));
        if (e.target.checked) {
            for (let type of self.model.qsa(".type:checked")) {
                setButtonChecked(type, false);
            }
        }
    });

    self.model.qs(".btn-tlds").addEventListener("click", function () {
        toggleHidden(self.model.qs(".tlds-block"));
    });

    self.model.qs(".input-tlds").addEventListener("change", function () {
        let numberOfTlds = self.tldsTagsInput.getValue().length;
        let error = numberOfTlds === 0;
        self.model.qs(".btn-tlds > .badge").textContent = numberOfTlds;
        self.model.qs(".btn-tlds").classList.toggle("btn-danger", error);
        self.model.qs(".btn-tlds").parentNode.classList.toggle("has-error", error);
        self.setAllowSave(!error);
    });
}

RuleInput.prototype.change = function () {
    this.updateRule();
    let newInput = RuleInputFactory(this.rule);
    this.model.parentNode.insertBefore(newInput.model, this.model);
    this.softRemove();
    newInput.toggleEdit();
    newInput.validate();
};

RuleInput.prototype.remove = function () {
    this.softRemove();
    if (this.indexOfRule() !== -1) {
        myOptionsManager.saveOption(this.optionsPath);
    } else {
        myOptionsManager.saveAllOptions();
    }
};

RuleInput.prototype.softRemove = function () {
    this.model.parentNode.removeChild(this.model);
    let i = this.indexOfRule();
    if (i !== -1) {
        myOptionsManager.options[this.optionsPath].splice(i, 1);
    }
};

RuleInput.prototype.save = function () {
    this.updateRule();
    if (this.indexOfRule() === -1) {
        myOptionsManager.options[this.optionsPath].push(this.rule);
        return myOptionsManager.saveAllOptions().then(this.updateModel.bind(this)).then(this.showSavedText.bind(this));
    }
    return myOptionsManager.saveOption(this.optionsPath).then(this.updateModel.bind(this)).then(this.showSavedText.bind(this));
};

RuleInput.prototype.showSavedText = function () {
    toggleFade(this.model.qs(".text-saved"));
};

RuleInput.prototype.setAllowSave = function (bool) {
    if (!bool || this.model.qs(".has-error:not(.hidden)")) {
        this.model.qs(".btn-save").setAttribute("disabled", "disabled");
    } else {
        this.model.qs(".btn-save").removeAttribute("disabled");
    }
};

RuleInput.prototype.toggleActive = function () {
    this.rule.active = !this.rule.active;
    this.setActiveState();
    if (this.indexOfRule() !== -1) {
        myOptionsManager.saveOption(this.optionsPath);
    }
};

RuleInput.prototype.toggleEdit = function () {
    toggleHidden(this.model.qs(".panel-collapse"));
};

RuleInput.prototype.setActiveState = function () {
    this.model.classList.toggle("disabled", !this.rule.active);
    this.model.qs(".btn-activate").textContent = this.rule.active ? 'Disable' : 'Enable';
};

RuleInput.prototype.validate = function () {
    this.setAllowSave(true);
    if (this.model.qs(".pattern:not(.hidden)")) {
        for (let input of this.model.qsa("input[pattern]:not(.hidden)")) {
            input.dispatchEvent(new Event("blur"));
        }
        this.validateTLDPattern();
    }
};

RuleInput.prototype.validateTLDPattern = function () {
    let isTldsPattern = tldStarPattern.test(this.model.qs(".host").value);
    toggleHidden(!isTldsPattern, this.model.qs(".btn-tlds").parentNode);
    toggleHidden(!isTldsPattern, this.model.qs(".tlds-block"));
    if (isTldsPattern && this.tldsTagsInput.getValue().length === 0) {
        this.setAllowSave(false);
        this.model.qs(".btn-tlds").classList.add("btn-danger");
        this.model.qs(".btn-tlds").parentNode.classList.add("has-error");
    }
};

RuleInput.prototype.indexOfRule = function () {
    return myOptionsManager.options[this.optionsPath].indexOf(this.rule);
};

RuleInput.prototype.updateModel = function () {
    this.model.qs(".icon").src = "../icons/icon-" + this.rule.action + "@19.png";
    this.model.qs(".title").textContent = this.title + (this.rule.pattern.allUrls ? "any URL" : encodeURIComponent(this.rule.pattern.host));
    this.model.qs(".description").textContent = this.description;
    this.model.qs(".scheme").value = this.rule.pattern.scheme;
    this.model.qs(".matchSubDomains").checked = this.rule.pattern.matchSubDomains;
    this.model.qs(".host").value = this.rule.pattern.host;
    this.model.qs(".path").value = this.rule.pattern.path;
    this.model.qs(".action").value = this.rule.action;
    if (this.rule.pattern.topLevelDomains) {
        this.model.qs(".btn-tlds > .badge").textContent = this.rule.pattern.topLevelDomains.length;
        this.tldsTagsInput.setValue(this.rule.pattern.topLevelDomains.join());
    }
    toggleHidden(!tldStarPattern.test(this.model.qs(".host").value), this.model.qs(".btn-tlds").parentNode);
    this.setActiveState();

    if (!this.rule.types || this.rule.types.length === 0) {
        setButtonChecked(this.model.qs(".any-type"), true);
        toggleHidden(true, this.model.qs(".btn-group-types"));
        setButtonChecked(this.model.qs(".type[value=main_frame]"), false);
    } else {
        for (let value of this.rule.types) {
            let type = this.model.qs("[value=" + value + "]");
            setButtonChecked(type, true);
            toggleHidden(false, type.parentNode);
        }
    }

    if (this.rule.pattern.allUrls) {
        setButtonChecked(this.model.qs(".any-url"), true);
        toggleHidden(true, this.model.qs(".host").parentNode, this.model.qs(".path").parentNode, this.model.qs(".pattern"));
    }
};

RuleInput.prototype.updateRule = function () {
    if (this.model.qs(".any-url").checked) {
        this.rule.pattern.allUrls = true;
    } else {
        this.rule.pattern.scheme = this.model.qs(".scheme").value;
        this.rule.pattern.matchSubDomains = this.model.qs(".matchSubDomains").checked;
        this.rule.pattern.host = this.model.qs(".host").value;
        this.rule.pattern.path = this.model.qs(".path").value;
        if (tldStarPattern.test(this.model.qs(".host").value)) {
            this.rule.pattern.topLevelDomains = this.tldsTagsInput.getValue();
        }
        delete this.rule.pattern.allUrls;
    }

    this.rule.types = Array.from(this.model.qsa(".type:checked"), type => type.value);
    if (this.rule.types.length === 0 || this.model.qs(".any-type").checked) {
        delete this.rule.types;
    }

    this.rule.action = this.model.qs(".action").value;
};

function cloneRuleInputModel() {
    let model = document.getElementById("ruleInputModel").cloneNode(true);
    model.removeAttribute("id");
    return model;
}

function setButtonChecked(button, checked) {
    button.checked = checked;
    button.parentNode.classList.toggle("active", checked);
}

function toggleHidden(hidden) {
    let hiddenClass = "hidden";
    if (typeof hidden === "boolean") {
        for (let i = 1; i < arguments.length; i++) {
            arguments[i].classList.toggle(hiddenClass, hidden);
        }
    } else if (hidden) {
        hidden.classList.toggle(hiddenClass);
    }
}

function toggleFade(element) {
    element.classList.add("fade");
    setTimeout(function () {
        element.classList.remove("fade");
    }, 2000);
}

function addInputValidation(input, callback) {
    function validateInput(e) {
        let input = e.target;
        let pattern;
        if (input.pattern) {
            pattern = new RegExp(e.target.pattern);
            let pass = pattern.test(input.value);
            input.parentNode.classList.toggle("has-error", !pass);
            callback(pass);
        }
    }

    input.addEventListener("input", validateInput);
    input.addEventListener("blur", validateInput);
}

function createOptions(target, options) {
    while (target.firstChild) {
        target.removeChild(target.firstChild);
    }
    for (let value of options) {
        let input = RuleInputFactory(value);
        target.appendChild(input.model);
    }
}

function init() {
    let inputFormRules = document.getElementById("rules");
    let inputFormWhitelist = document.getElementById("whitelist");
    let inputFormParams = tagsInput(document.getElementById("queryParams"));

    createOptions(inputFormRules, myOptionsManager.options.rules);
    createOptions(inputFormWhitelist, myOptionsManager.options.whitelist);
    inputFormParams.setValue(myOptionsManager.options.queryParams.join());

    document.getElementById("addNewRule").addEventListener("click", function () {
        let ruleInput = RuleInputFactory();
        inputFormRules.appendChild(ruleInput.model);
        ruleInput.toggleEdit();
        ruleInput.model.qs(".host").focus();
        ruleInput.model.scrollIntoView();
    });
    document.getElementById("queryParams").addEventListener("change", function () {
        myOptionsManager.saveOption("queryParams", inputFormParams.getValue()).then(function () {
            toggleFade(document.getElementById("saveParamsSuccess"));
        });
    });
    document.getElementById("restoreRules").addEventListener("click", function () {
        myOptionsManager.restoreDefault("rules").then(function () {
            createOptions(inputFormRules, myOptionsManager.options.rules);
        });
        myOptionsManager.restoreDefault("whitelist").then(function () {
            createOptions(inputFormWhitelist, myOptionsManager.options.whitelist);
        });
    });
    document.getElementById("restoreParams").addEventListener("click", function () {
        myOptionsManager.restoreDefault("queryParams").then(function () {
            inputFormParams.setValue(myOptionsManager.options.queryParams.join());
        });
    });
}

document.addEventListener("DOMContentLoaded", function () {
    myOptionsManager.loadOptions(init);
});
