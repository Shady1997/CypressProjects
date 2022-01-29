"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCiProject = exports.writeProjectId = exports.getId = exports.add = exports.remove = exports.getProjectStatus = exports.getProjectStatuses = exports._getProject = exports._mergeState = exports._mergeDetails = exports.getDashboardProjects = exports.getPathsAndIds = exports.paths = exports.getOrgs = void 0;
const tslib_1 = require("tslib");
const debug_1 = (0, tslib_1.__importDefault)(require("debug"));
const commit_info_1 = (0, tslib_1.__importDefault)(require("@cypress/commit-info"));
const lodash_1 = (0, tslib_1.__importDefault)(require("lodash"));
const logger_1 = (0, tslib_1.__importDefault)(require("./logger"));
const api_1 = (0, tslib_1.__importDefault)(require("./api"));
const cache_1 = (0, tslib_1.__importDefault)(require("./cache"));
const user_1 = (0, tslib_1.__importDefault)(require("./user"));
const keys_1 = (0, tslib_1.__importDefault)(require("./util/keys"));
const settings = (0, tslib_1.__importStar)(require("./util/settings"));
const project_base_1 = require("./project-base");
const project_utils_1 = require("./project_utils");
const debug = (0, debug_1.default)('cypress:server:project_static');
function getOrgs() {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const authToken = yield user_1.default.ensureAuthToken();
        return api_1.default.getOrgs(authToken);
    });
}
exports.getOrgs = getOrgs;
function paths() {
    return cache_1.default.getProjectRoots();
}
exports.paths = paths;
function getPathsAndIds() {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const projectRoots = yield cache_1.default.getProjectRoots();
        // this assumes that the configFile for a cached project is 'cypress.json'
        // https://git.io/JeGyF
        return Promise.all(projectRoots.map((projectRoot) => (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
            return {
                path: projectRoot,
                id: yield settings.id(projectRoot),
            };
        })));
    });
}
exports.getPathsAndIds = getPathsAndIds;
function getDashboardProjects() {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const authToken = yield user_1.default.ensureAuthToken();
        debug('got auth token: %o', { authToken: keys_1.default.hide(authToken) });
        return api_1.default.getProjects(authToken);
    });
}
exports.getDashboardProjects = getDashboardProjects;
function _mergeDetails(clientProject, project) {
    return lodash_1.default.extend({}, clientProject, project, { state: 'VALID' });
}
exports._mergeDetails = _mergeDetails;
function _mergeState(clientProject, state) {
    return lodash_1.default.extend({}, clientProject, { state });
}
exports._mergeState = _mergeState;
function _getProject(clientProject, authToken) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        debug('get project from api', clientProject.id, clientProject.path);
        try {
            const project = yield api_1.default.getProject(clientProject.id, authToken);
            debug('got project from api');
            return _mergeDetails(clientProject, project);
        }
        catch (err) {
            debug('failed to get project from api', err.statusCode);
            switch (err.statusCode) {
                case 404:
                    // project doesn't exist
                    return _mergeState(clientProject, 'INVALID');
                case 403:
                    // project exists, but user isn't authorized for it
                    return _mergeState(clientProject, 'UNAUTHORIZED');
                default:
                    throw err;
            }
        }
    });
}
exports._getProject = _getProject;
function getProjectStatuses(clientProjects = []) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        debug(`get project statuses for ${clientProjects.length} projects`);
        const authToken = yield user_1.default.ensureAuthToken();
        debug('got auth token: %o', { authToken: keys_1.default.hide(authToken) });
        const projects = ((yield api_1.default.getProjects(authToken)) || []);
        debug(`got ${projects.length} projects`);
        const projectsIndex = lodash_1.default.keyBy(projects, 'id');
        return Promise.all(lodash_1.default.map(clientProjects, (clientProject) => {
            debug('looking at', clientProject.path);
            // not a CI project, just mark as valid and return
            if (!clientProject.id) {
                debug('no project id');
                return _mergeState(clientProject, 'VALID');
            }
            const project = projectsIndex[clientProject.id];
            if (project) {
                debug('found matching:', project);
                // merge in details for matching project
                return _mergeDetails(clientProject, project);
            }
            debug('did not find matching:', project);
            // project has id, but no matching project found
            // check if it doesn't exist or if user isn't authorized
            return _getProject(clientProject, authToken);
        }));
    });
}
exports.getProjectStatuses = getProjectStatuses;
function getProjectStatus(clientProject) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        debug('get project status for client id %s at path %s', clientProject.id, clientProject.path);
        if (!clientProject.id) {
            debug('no project id');
            return Promise.resolve(_mergeState(clientProject, 'VALID'));
        }
        const authToken = yield user_1.default.ensureAuthToken();
        debug('got auth token: %o', { authToken: keys_1.default.hide(authToken) });
        return _getProject(clientProject, authToken);
    });
}
exports.getProjectStatus = getProjectStatus;
function remove(path) {
    return cache_1.default.removeProject(path);
}
exports.remove = remove;
function add(path, options) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        // don't cache a project if a non-default configFile is set
        // https://git.io/JeGyF
        if (settings.configFile(options) !== 'cypress.json') {
            return Promise.resolve({ path });
        }
        try {
            yield cache_1.default.insertProject(path);
            const id = yield getId(path);
            return {
                id,
                path,
            };
        }
        catch (e) {
            return { path };
        }
    });
}
exports.add = add;
function getId(path) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const configFile = yield (0, project_utils_1.getDefaultConfigFilePath)(path);
        return new project_base_1.ProjectBase({ projectRoot: path, testingType: 'e2e', options: { configFile } }).getProjectId();
    });
}
exports.getId = getId;
function writeProjectId({ id, projectRoot, configFile }) {
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const attrs = { projectId: id };
        logger_1.default.info('Writing Project ID', lodash_1.default.clone(attrs));
        // TODO: We need to set this
        // this.generatedProjectIdTimestamp = new Date()
        yield settings.write(projectRoot, attrs, { configFile });
        return id;
    });
}
exports.writeProjectId = writeProjectId;
function createCiProject(_a) {
    var { projectRoot, configFile } = _a, projectDetails = (0, tslib_1.__rest)(_a, ["projectRoot", "configFile"]);
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        debug('create CI project with projectDetails %o projectRoot %s', projectDetails);
        const authToken = yield user_1.default.ensureAuthToken();
        const remoteOrigin = yield commit_info_1.default.getRemoteOrigin(projectRoot);
        debug('found remote origin at projectRoot %o', {
            remoteOrigin,
            projectRoot,
        });
        const newProject = yield api_1.default.createProject(projectDetails, remoteOrigin, authToken);
        yield writeProjectId({
            configFile,
            projectRoot,
            id: newProject.id,
        });
        return newProject;
    });
}
exports.createCiProject = createCiProject;
