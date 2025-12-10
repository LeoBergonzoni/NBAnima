"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RootRedirect;
const navigation_1 = require("next/navigation");
function RootRedirect() {
    (0, navigation_1.redirect)('/it');
}
