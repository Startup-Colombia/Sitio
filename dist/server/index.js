(function(FuseBox){FuseBox.$fuse$=FuseBox;
var __process_env__ = {"isProduction":false};
FuseBox.pkg("default", {}, function(___scope___){
___scope___.file("server/index.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
app_1.default();
//# sourceMappingURL=index.js.map
});
___scope___.file("server/app.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Koa = require("koa");
const serve = require("koa-static");
const mount = require("koa-mount");
const bodyParser = require("koa-bodyparser");
const api_1 = require("./api");
const static_1 = require("./static");
function runServer() {
    let port = process.env.PORT || 3001;
    let app = new Koa();
    require('http').Server(app.callback());
    if (process.env.ENV !== 'production') {
        app.use(require('kcors')());
    }
    app.use(bodyParser());
    app.use(serve('dist/public'));
    app
        .use(mount('/api', api_1.default.routes()))
        .use(mount('/api', api_1.default.allowedMethods()));
    app
        .use(mount('/', static_1.default.routes()))
        .use(mount('/', static_1.default.allowedMethods()));
    app.listen(port);
    console.log('Server running in ' + port + ' ...');
}
exports.default = runServer;
//# sourceMappingURL=app.js.map
});
___scope___.file("server/api.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
dotenv.config();
const Cloudant = require("cloudant");
const request = require("request");
const Router = require("koa-router");
const jwt = require("jsonwebtoken");
const koaJWT = require("koa-jwt");
const core_1 = require("fractal-core/core");
const utils_1 = require("../app/utils");
var key = process.env.cloudant_key;
var password = process.env.cloudant_password;
var jwt_secret = process.env.jwt_secret;
var emailPassword = process.env.email_password;
if (!key || !password || !jwt_secret || !emailPassword) {
    throw 'Error! environment not setted';
}
let router = Router();
const runAPI = (router, cloudant) => {
    let usersDB = cloudant.use('users');
    let companiesDB = cloudant.use('companies');
    let companiesUnreviewedDB = cloudant.use('companies_unreviewed');
    let metricsDB = cloudant.use('metrics');
    // --- API
    // PUBLIC
    router.post('/auth', async (ctx) => {
        let data;
        let socialToken = ctx.request.body.socialToken;
        try {
            data = await new Promise((resolve, reject) => request({
                url: 'https://graph.facebook.com/me',
                qs: { access_token: socialToken, fields: 'id,name,email,verified,picture{url}' },
            }, (error, response, body) => {
                if (!error && response.statusCode == 200) {
                    resolve(JSON.parse(body));
                }
                else {
                    reject(error);
                }
            }));
        }
        catch (err) {
            return ctx.body = '-1';
        }
        if (!data.verified) {
            return ctx.body = '-2'; // unverified FB account
        }
        try {
            let user = await usersDB.get(data.id);
            // refresh name
            user.name = data.name;
            user.fbData = {
                verified: data.verified,
                email: data.email,
                pictureURL: data.picture.data.url,
            };
            user.timestamp = (new Date()).toISOString();
            await usersDB.insert(user);
        }
        catch (error) {
            // create a new user
            let user = {
                _id: data.id,
                name: data.name,
                email: '',
                networks: {
                    facebook: data.id,
                },
                fbData: {
                    verified: data.verified,
                    email: data.email,
                    pictureURL: data.picture.data.url,
                },
                companies: {},
                timestamp: (new Date()).toISOString(),
            };
            let res = await usersDB.insert(user);
            let metric = {
                type: 'newUser',
                userId: res.id,
                companyId: '',
                companyName: '',
                timestamp: user.timestamp,
            };
            await metricsDB.insert(metric);
        }
        ctx.body = jwt.sign(data, jwt_secret, {
            expiresIn: '8h',
            issuer: 'startupcol.com',
        });
    });
    // PRIVATE
    router.use(koaJWT({ secret: jwt_secret }));
    router.get('/user', async (ctx) => {
        try {
            ctx.body = await usersDB.get(ctx.state.user.id);
            ctx.body.code = 0;
        }
        catch (err) {
            ctx.body = { code: -1 };
        }
    });
    router.get('/companies', async (ctx) => {
        try {
            let res = await companiesDB.search('companies', 'companies', {
                q: `userId:${ctx.state.user.id}*`,
                include_docs: true,
            });
            ctx.body = res.rows.map(r => r.doc);
        }
        catch (err) {
            ctx.body = { code: -1 };
        }
    });
    router.post('/companyRequest', async (ctx) => {
        let company = ctx.request.body;
        let user;
        try {
            user = await usersDB.get(ctx.state.user.id);
            if (!company._userEmail && !user.email) {
                return ctx.body = { code: -1 };
            }
            else if (company._userEmail) {
                user.email = company._userEmail;
                delete company._userEmail;
                user.timestamp = (new Date()).toISOString();
                await usersDB.insert(user);
            }
        }
        catch (err) {
            return ctx.body = { code: -1 };
        }
        if (company.id) {
            // company is already in list
            try {
                let companyIn = await companiesDB.get(company.id);
                company.userFb = companyIn.userFb;
                if (companyIn.userId) {
                    // something already owns the company
                    return ctx.body = { code: -2 };
                }
            }
            catch (err) {
                return ctx.body = { code: -3 };
            }
        }
        company.userId = user._id;
        company.user = user.name;
        try {
            if (true) {
                company.timestamp = (new Date()).toISOString();
                await companiesUnreviewedDB.insert(company);
                let metric = {
                    type: 'companyRequest',
                    userId: user._id,
                    companyId: '',
                    companyName: company.name,
                    timestamp: company.timestamp,
                };
                await metricsDB.insert(metric);
                sendEmail({
                    from: '"Startup Colombia" soporte@startupcol.com',
                    to: 'carloslfu@gmail.com',
                    subject: 'Company Request - ' + company.name,
                    text: `
${company.name}

${user.name} - ${user.email} - ${user._id}
  `
                }, (error, info) => {
                    if (error) {
                        // return console.log(error)
                    }
                    // console.log('Message %s sent: %s', info.messageId, info.response)
                });
                return ctx.body = { code: 0 };
            }
            else {
                return ctx.body = { code: -4 };
            }
        }
        catch (err) {
            return ctx.body = { code: -5 };
        }
    });
    // Update a company
    router.post('/company', async (ctx) => {
        let userId = ctx.state.user.id;
        let companyUpdated = ctx.request.body;
        try {
            let company = await companiesDB.get(companyUpdated._id);
            if (company.userId !== userId) {
                return ctx.body = { code: -1 };
            }
            if (companyUpdated.name !== company.name) {
                // search if there are a name collision, this is client side validated
                let nameQuery = companyUpdated.name
                    .split(' ')
                    .map(p => 'name:' + utils_1.normalize(p.trim()))
                    .join(' AND ');
                let res = await companiesDB.search('companies', 'companies', {
                    q: nameQuery,
                    include_docs: true,
                });
                let sameName = res.rows.filter(r => utils_1.strToLink(r.doc.name) === utils_1.strToLink(companyUpdated.name));
                if (sameName[0]) {
                    // Something weird, bad API use
                    return { code: -99 };
                }
            }
            companyUpdated._rev = company._rev;
            let companyResult = core_1.deepmerge(company, companyUpdated);
            companyResult.places = companyUpdated.places.slice(0, 20);
            companyResult.tags = companyUpdated.tags.slice(0, 5);
            // Verify integrity of data
            if (false) {
                return ctx.body = { code: -2 };
            }
            companyResult.timestamp = (new Date()).toISOString();
            await companiesDB.insert(companyResult);
            let metric = {
                type: 'companyUpdate',
                userId: userId,
                companyId: companyResult._id,
                companyName: companyResult.name,
                timestamp: companyResult.timestamp,
            };
            await metricsDB.insert(metric);
            ctx.body = { code: 0 };
        }
        catch (err) {
            console.log(err);
            ctx.body = { code: -3 };
        }
    });
    // REVIEW
    let carloslfuId = '1741269969231686';
    router.get('/unreviewed/:num', async (ctx) => {
        if (ctx.state.user.id !== carloslfuId) {
            return ctx.body = { code: -1 };
        }
        let num = 0;
        if (ctx.params.num !== undefined) {
            num = ctx.params.num;
        }
        try {
            let res = await companiesUnreviewedDB.list({ include_docs: true, limit: 1 });
            let companies = res.rows.map(r => r.doc);
            if (companies[num]) {
                ctx.body = companies[num];
            }
            else {
                return ctx.body = { code: -2 };
            }
        }
        catch (err) {
            return ctx.body = { code: -1 };
        }
    });
    router.post('/accept', async (ctx) => {
        let userId = ctx.state.user.id;
        if (userId !== carloslfuId) {
            return ctx.body = { code: -1 };
        }
        try {
            let companyRequest = ctx.request.body;
            let company;
            if (companyRequest.id) {
                company = await companiesDB.get(companyRequest.id);
                // if (companyRequest.name !== company.name) {
                //   // Something weird, bad API use
                //   return { code: -99 }
                // }
            }
            let companyUnreviewed = await companiesUnreviewedDB.get(companyRequest._id);
            // remove unreviewed register
            await companiesUnreviewedDB.destroy(companyUnreviewed._id, companyUnreviewed._rev);
            let companyResult = core_1.deepmerge(companyUnreviewed, companyRequest);
            companyResult.places = companyRequest.places.slice(0, 20);
            companyResult.tags = companyRequest.tags.slice(0, 5);
            delete companyResult.id;
            delete companyResult._id;
            delete companyResult._rev;
            if (companyRequest.id) {
                companyResult._id = company._id;
                companyResult._rev = company._rev;
            }
            // Verify integrity of data
            if (false) {
                return ctx.body = { code: -3 };
            }
            // Update or create company
            companyResult.timestamp = (new Date()).toISOString();
            let res = await companiesDB.insert(companyResult);
            let metric = {
                type: 'companyAccept',
                userId: userId,
                companyId: res.id,
                companyName: companyResult.name,
                timestamp: companyResult.timestamp,
            };
            await metricsDB.insert(metric);
            let user = await usersDB.get(companyResult.userId);
            // Add company to user
            user.companies[res.id] = true;
            user.timestamp = (new Date()).toISOString();
            await usersDB.insert(user);
            sendEmail({
                from: '"Startup Colombia" soporte@startupcol.com',
                to: user.email,
                subject: 'Se ha actualizado ' + companyResult.name + '!',
                text: `Hola ${user.name.split(' ')[0]}

Tu empresa ${companyResult.name} ha sido actualizada en la plataforma! Ahora puedes modificar los datos directamente desde el Panel de Control. También tendrás acceso a interesantes características que iré implementando. Escríbeme a este correo si tienes alguna duda, inquietud, sugerencia o idea. También puedes contactarme por Facebook si así lo deseas.

Un saludo,
Carlos Galarza
`
            }, (error, info) => {
                if (error) {
                    // return console.log(error)
                }
                // console.log('Message %s sent: %s', info.messageId, info.response)
            });
            ctx.body = { code: 0 };
        }
        catch (err) {
            return ctx.body = { code: -2 };
        }
    });
    router.post('/deny', async (ctx) => {
        let userId = ctx.state.user.id;
        if (userId !== carloslfuId) {
            return ctx.body = { code: -1 };
        }
        try {
            let companyUnreviewed = await companiesUnreviewedDB.get(ctx.request.body.id);
            // remove unreviewed register
            await companiesUnreviewedDB.destroy(companyUnreviewed._id, companyUnreviewed._rev);
            let metric = {
                type: 'companyDeny',
                userId: userId,
                companyId: '',
                companyName: companyUnreviewed.name,
                timestamp: (new Date()).toISOString(),
            };
            await metricsDB.insert(metric);
            let user = await usersDB.get(companyUnreviewed.userId);
            sendEmail({
                from: '"Startup Colombia" soporte@startupcol.com',
                to: user.email,
                subject: 'Error en solicitud, ' + companyUnreviewed.name,
                text: `Hola ${user.name.split(' ')[0]}

Hay algo erróneo en la solicitud de ${companyUnreviewed.name}, debes hacer una nueva solicitud. Escríbeme si tienes alguna duda o inquietud.

Un saludo,
Carlos Galarza
`,
            }, (error, info) => {
                if (error) {
                    // return console.log(error)
                }
                // console.log('Message %s sent: %s', info.messageId, info.response)
            });
            return ctx.body = { code: 0 };
        }
        catch (err) {
            return ctx.body = { code: -2 };
        }
    });
};
// Asegura que la API siempre corra
function ensureRunAPI(router) {
    Cloudant({
        account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
        key: key,
        password: password,
        plugin: 'promises',
    }, (err, cloudant, reply) => {
        if (err) {
            console.log('No connection to Database, trying again in 4 seconds ...');
            setTimeout(() => ensureRunAPI(router), 4000);
            return;
        }
        runAPI(router, cloudant);
    });
}
ensureRunAPI(router);
// Envio de emails from soporte@startupcol.com
var nodemailer = require('nodemailer');
// Create the transporter with the required configuration for Gmail
// change the user and pass !
var transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
        user: 'soporte@startupcol.com',
        pass: emailPassword,
    }
});
function sendEmail(mailOptions, cb) {
    transporter.sendMail(mailOptions, cb);
}
exports.default = router;
//# sourceMappingURL=api.js.map
});
___scope___.file("app/utils.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.search = (text, searchFilter, bookmark, companiesPerPage, extraQuery = '') => {
    let query = exports.buildSearchString(normalize(text), searchFilter) + extraQuery;
    let uri = encodeURIComponent(query);
    return fetch(`${config_1.cloudantURL}/companies/_design/companies/_search/companies?q=${uri}&limit=${companiesPerPage}`
        + (bookmark ? `&bookmark=${bookmark}` : '') + `&include_docs=true`)
        .then(r => r.json())
        .then(r => Promise.resolve([r.rows.map(r => r.doc), r.total_rows, r.bookmark]))
        .catch(err => { });
};
function strToLink(str) {
    return removeDiacritics(str.toLocaleLowerCase().replace(/ /g, '-'));
}
exports.strToLink = strToLink;
exports.extractId = (urlString) => {
    try {
        let url = new URL(urlString);
        return url.hash.substr(1);
    }
    catch (err) {
        return '';
    }
};
exports.extractSearch = (urlString) => {
    try {
        let url = new URL(urlString);
        return url.search.substr(1);
    }
    catch (err) {
        return '';
    }
};
function refreshHashScroll() {
    setTimeout(() => {
        let hash = window.location.hash;
        if (hash.substr(1).length > 0) {
            // refresh scrolling
            window.location.href = '#';
            window.location.href = hash;
        }
    }, 0);
}
exports.refreshHashScroll = refreshHashScroll;
function indexesOf(c, str) {
    var indexes = [];
    for (var i = 0; i < str.length; i++) {
        if (str[i] === c)
            indexes.push(i);
    }
    return indexes;
}
exports.indexesOf = indexesOf;
function changeSearchString(str) {
    var newurl = window.location.protocol
        + '//' + window.location.host + window.location.pathname + '?' + str + window.location.hash;
    window.history.pushState({ path: newurl }, '', newurl);
}
exports.changeSearchString = changeSearchString;
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}
exports.isNumeric = isNumeric;
function normalize(str) {
    return removeDiacritics(str.toLowerCase());
}
exports.normalize = normalize;
exports.buildSearchString = (textIn, searchFilterName) => {
    let text = textIn
        .replace(/\/|-|,/g, ' ')
        .split(' ')
        .map(p => p.trim())
        .join(' ');
    if (text === '') {
        return '*:*';
    }
    else {
        return text
            .split(' ')
            .filter(p => p !== '')
            .map(p => p.trim())
            .join(' ')
            .split('+')
            .map(p => p.trim())
            .join(' AND ')
            .split(' ')
            .map(p => p === 'AND' || p.indexOf(':') !== -1
            ? p
            : searchFilterName + ':' + p + (p.indexOf('^') === -1 ? '*' : '')).join(' ');
    }
};
// remover duplicados
function orderCompanies(empresas) {
    // se organiza en orden alfabetico
    let empresasNoDupOrd = empresas
        .sort((a, b) => {
        if (a.name.toLowerCase() < b.name.toLowerCase())
            return -1;
        if (a.name.toLowerCase() > b.name.toLowerCase())
            return 1;
        return 0;
    });
    return empresasNoDupOrd;
}
exports.orderCompanies = orderCompanies;
var defaultDiacriticsRemovalMap = [
    { 'base': 'A', 'letters': '\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F' },
    { 'base': 'AA', 'letters': '\uA732' },
    { 'base': 'AE', 'letters': '\u00C6\u01FC\u01E2' },
    { 'base': 'AO', 'letters': '\uA734' },
    { 'base': 'AU', 'letters': '\uA736' },
    { 'base': 'AV', 'letters': '\uA738\uA73A' },
    { 'base': 'AY', 'letters': '\uA73C' },
    { 'base': 'B', 'letters': '\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181' },
    { 'base': 'C', 'letters': '\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E' },
    { 'base': 'D', 'letters': '\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779\u00D0' },
    { 'base': 'DZ', 'letters': '\u01F1\u01C4' },
    { 'base': 'Dz', 'letters': '\u01F2\u01C5' },
    { 'base': 'E', 'letters': '\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E' },
    { 'base': 'F', 'letters': '\u0046\u24BB\uFF26\u1E1E\u0191\uA77B' },
    { 'base': 'G', 'letters': '\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E' },
    { 'base': 'H', 'letters': '\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D' },
    { 'base': 'I', 'letters': '\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197' },
    { 'base': 'J', 'letters': '\u004A\u24BF\uFF2A\u0134\u0248' },
    { 'base': 'K', 'letters': '\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2' },
    { 'base': 'L', 'letters': '\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780' },
    { 'base': 'LJ', 'letters': '\u01C7' },
    { 'base': 'Lj', 'letters': '\u01C8' },
    { 'base': 'M', 'letters': '\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C' },
    { 'base': 'N', 'letters': '\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4' },
    { 'base': 'NJ', 'letters': '\u01CA' },
    { 'base': 'Nj', 'letters': '\u01CB' },
    { 'base': 'O', 'letters': '\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C' },
    { 'base': 'OI', 'letters': '\u01A2' },
    { 'base': 'OO', 'letters': '\uA74E' },
    { 'base': 'OU', 'letters': '\u0222' },
    { 'base': 'OE', 'letters': '\u008C\u0152' },
    { 'base': 'oe', 'letters': '\u009C\u0153' },
    { 'base': 'P', 'letters': '\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754' },
    { 'base': 'Q', 'letters': '\u0051\u24C6\uFF31\uA756\uA758\u024A' },
    { 'base': 'R', 'letters': '\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782' },
    { 'base': 'S', 'letters': '\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784' },
    { 'base': 'T', 'letters': '\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786' },
    { 'base': 'TZ', 'letters': '\uA728' },
    { 'base': 'U', 'letters': '\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244' },
    { 'base': 'V', 'letters': '\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245' },
    { 'base': 'VY', 'letters': '\uA760' },
    { 'base': 'W', 'letters': '\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72' },
    { 'base': 'X', 'letters': '\u0058\u24CD\uFF38\u1E8A\u1E8C' },
    { 'base': 'Y', 'letters': '\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE' },
    { 'base': 'Z', 'letters': '\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762' },
    { 'base': 'a', 'letters': '\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250' },
    { 'base': 'aa', 'letters': '\uA733' },
    { 'base': 'ae', 'letters': '\u00E6\u01FD\u01E3' },
    { 'base': 'ao', 'letters': '\uA735' },
    { 'base': 'au', 'letters': '\uA737' },
    { 'base': 'av', 'letters': '\uA739\uA73B' },
    { 'base': 'ay', 'letters': '\uA73D' },
    { 'base': 'b', 'letters': '\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253' },
    { 'base': 'c', 'letters': '\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184' },
    { 'base': 'd', 'letters': '\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A' },
    { 'base': 'dz', 'letters': '\u01F3\u01C6' },
    { 'base': 'e', 'letters': '\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD' },
    { 'base': 'f', 'letters': '\u0066\u24D5\uFF46\u1E1F\u0192\uA77C' },
    { 'base': 'g', 'letters': '\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F' },
    { 'base': 'h', 'letters': '\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265' },
    { 'base': 'hv', 'letters': '\u0195' },
    { 'base': 'i', 'letters': '\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131' },
    { 'base': 'j', 'letters': '\u006A\u24D9\uFF4A\u0135\u01F0\u0249' },
    { 'base': 'k', 'letters': '\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3' },
    { 'base': 'l', 'letters': '\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747' },
    { 'base': 'lj', 'letters': '\u01C9' },
    { 'base': 'm', 'letters': '\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F' },
    { 'base': 'n', 'letters': '\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5' },
    { 'base': 'nj', 'letters': '\u01CC' },
    { 'base': 'o', 'letters': '\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275' },
    { 'base': 'oi', 'letters': '\u01A3' },
    { 'base': 'ou', 'letters': '\u0223' },
    { 'base': 'oo', 'letters': '\uA74F' },
    { 'base': 'p', 'letters': '\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755' },
    { 'base': 'q', 'letters': '\u0071\u24E0\uFF51\u024B\uA757\uA759' },
    { 'base': 'r', 'letters': '\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783' },
    { 'base': 's', 'letters': '\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B' },
    { 'base': 't', 'letters': '\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787' },
    { 'base': 'tz', 'letters': '\uA729' },
    { 'base': 'u', 'letters': '\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289' },
    { 'base': 'v', 'letters': '\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C' },
    { 'base': 'vy', 'letters': '\uA761' },
    { 'base': 'w', 'letters': '\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73' },
    { 'base': 'x', 'letters': '\u0078\u24E7\uFF58\u1E8B\u1E8D' },
    { 'base': 'y', 'letters': '\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF' },
    { 'base': 'z', 'letters': '\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763' }
];
var diacriticsMap = {};
for (var i = 0; i < defaultDiacriticsRemovalMap.length; i++) {
    var letters = defaultDiacriticsRemovalMap[i].letters;
    for (var j = 0; j < letters.length; j++) {
        diacriticsMap[letters[j]] = defaultDiacriticsRemovalMap[i].base;
    }
}
function removeDiacritics(str) {
    return str.replace(/[^\u0000-\u007E]/g, function (a) {
        return diacriticsMap[a] || a;
    });
}
exports.removeDiacritics = removeDiacritics;
//# sourceMappingURL=utils.js.map
});
___scope___.file("app/config.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = {
    DEV: false,
};
exports.setDev = (value) => exports.config.DEV = value;
exports.getDev = (value) => exports.config.DEV;
exports.getServer = () => exports.config.DEV ? 'http://localhost:3001' : '';
exports.cloudantURL = 'https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com';
//# sourceMappingURL=config.js.map
});
___scope___.file("server/static.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const request = require("request");
const Router = require("koa-router");
const fractal_core_1 = require("fractal-core");
const ssr_1 = require("fractal-core/utils/ssr");
const utils_1 = require("../app/utils");
const utils_2 = require("./utils");
const module_1 = require("../app/module");
const Root = require("../app/Root");
let staticRouter = new Router();
try {
    let html = fs.readFileSync('./app/index.html', 'utf8');
    let css = fs.readFileSync('./app/styles.css', 'utf8');
    staticRouter.get('/:name', async (ctx) => {
        try {
            let nameParam = decodeURIComponent(ctx.params.name);
            let name = nameParam.replace(/-/g, ' ');
            let query = name
                .split(' ')
                .map(p => 'name:' + p)
                .join(' OR ');
            let queryURI = encodeURIComponent(query);
            let result = await new Promise((resolve, reject) => request('https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_design/companies/_search/companies?q=' + queryURI + '&include_docs=true&limit=1', (error, res, body) => {
                if (error) {
                    return reject(error);
                }
                resolve(body);
            }));
            result = JSON.parse(result);
            let company;
            for (let i = 0, len = result.rows.length; i < len; i++) {
                if (result.rows[i] && utils_1.strToLink(result.rows[i].doc.name) === nameParam) {
                    company = result.rows[i].doc;
                    company.fetched = true;
                    break;
                }
            }
            let companyOriginal = company;
            let keywords = [];
            if (!company) {
                company = { name };
            }
            else if (company.description) {
                keywords = utils_2.getKeywords(company.description);
            }
            let title = companyOriginal.name || '';
            let description = companyOriginal.description || '';
            let author = companyOriginal.user || '';
            ctx.body = await ssr_1.renderHTML({
                root: Root,
                runModule: module_1.runModule,
                bundlePaths: [],
                lang: 'es',
                html,
                css,
                title,
                description,
                keywords: keywords.join(','),
                author,
                url: '/' + ctx.params.name,
                cb: async (app) => {
                    await fractal_core_1.sendMsg(app, 'Root', 'toRoute', ['Site', { state: company }]);
                }
            });
        }
        catch (err) {
            ctx.status = err.status || 500;
            ctx.body = err || 'Ha ocurrido un error, lo solucionare en un momento';
        }
    });
}
catch (err) {
    console.log(err);
}
exports.default = staticRouter;
//# sourceMappingURL=static.js.map
});
___scope___.file("server/utils.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const es = require("keyword-extractor/lib/stopwords/es");
const request = require("request");
const utils_1 = require("../app/utils");
exports.getKeywords = (description) => {
    let parts = description
        .replace(/\.|,/g, '')
        .split(' ')
        .map(p => p.trim().toLowerCase());
    let keywords = [];
    let keyword;
    for (let i = 0, len = parts.length; i < len; i++) {
        if (es.stopwords.indexOf(parts[i]) !== -1) {
            if (i !== 0) {
                keywords.push(keyword);
            }
            keyword = '';
        }
        else {
            if (i === 0) {
                keyword = parts[i];
            }
            else {
                keyword += ' ' + parts[i];
            }
            if (i === len - 1) {
                keywords.push(keyword);
            }
        }
    }
    keywords = keywords.filter(k => k !== '');
    return keywords;
};
// DB
async function getCategories() {
    let result = await new Promise((resolve, reject) => request('https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_all_docs?include_docs=true', (error, res, body) => {
        if (error) {
            return reject(error);
        }
        resolve(body);
    }));
    result = JSON.parse(result);
    let companies = result.rows.map(r => r.doc);
    let categoriesObj = {};
    companies.forEach(c => {
        if (!c.tags)
            return;
        c.tags.forEach(t => {
            categoriesObj[t] = {
                name: t,
                link: '/categoria/' + utils_1.strToLink(t.replace(/-|\//g, ' ').split(' ').map(p => p.trim()).filter(p => p).join(' ')),
            };
        });
    });
    let categories = [];
    let name;
    for (name in categoriesObj) {
        categories.push(categoriesObj[name]);
    }
    return categories;
}
exports.getCategories = getCategories;
async function getCategoryCompanies(category) {
    let name = category.replace(/-|\//g, ' ');
    let query = name
        .split(' ')
        .map(p => 'tags:' + p.trim())
        .join(' AND ');
    let queryURI = encodeURIComponent(query);
    let result = await new Promise((resolve, reject) => request('https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_design/companies/_search/companies?q=' + queryURI + '&include_docs=true', (error, res, body) => {
        if (error) {
            return reject(error);
        }
        resolve(body);
    }));
    result = JSON.parse(result);
    let companies = result
        .rows
        .map(r => r.doc)
        .map(c => ({
        name: c.name,
        link: '/' + utils_1.strToLink(c.name),
    }));
    return companies;
}
exports.getCategoryCompanies = getCategoryCompanies;
//# sourceMappingURL=utils.js.map
});
___scope___.file("app/module.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const style_1 = require("fractal-core/groups/style");
exports.runModule = (Root, DEV, options) => fractal_core_1.run(Object.assign({ log: DEV, record: DEV, Root }, options, { groups: {
        style: style_1.styleHandler('', DEV),
    }, tasks: {
        route: mod => {
            if (typeof window !== 'undefined') {
                if (!window.ssrInitialized) {
                    if (window.location.pathname === '/') {
                        let hash = window.location.hash;
                        let search = window.location.search;
                        window.history.pushState({ route: '/', hash, search }, '', '/' + hash + search);
                    }
                }
                window.onpopstate = ev => {
                    if (ev.state) {
                        mod.dispatchEv({}, ['Root', 'toRoute', [ev.state.route || '/', ev.state]]);
                    }
                };
            }
            return {
                state: {},
                handle: async ([route, state]) => {
                    if (typeof window !== 'undefined') {
                        window.history.pushState({ route }, route, route);
                    }
                    mod.dispatchEv({}, ['Root', 'toRoute', [route, { state }]]);
                },
                dispose: () => { },
            };
        },
    }, interfaces: {
        view: view_1.viewHandler('#app'),
    } }, DEV ? fractal_core_1.logFns : {}));

});
___scope___.file("app/Root/index.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const config_1 = require("../config");
const utils_1 = require("../utils");
const constants_1 = require("./constants");
if (typeof window !== 'undefined') {
    var hello = require('hellojs/dist/hello.all.js');
}
const Main = require("./Main");
const Dashboard = require("./Dashboard");
const Admin = require("./Admin");
const Site = require("./Site");
exports.name = 'Root';
exports.components = {
    Main,
    Dashboard,
    Admin,
    Site,
};
exports.state = {
    section: 'Main',
    route: 'Main',
    token: '',
    name: '',
    picture: '',
    _nest: exports.components,
};
async function routeToComp(hash, F) {
    if (hash === '#-panel') {
        await F.toIt('setRoute', 'Dashboard');
        await F.toChild('Dashboard', 'setActive');
    }
    else if (hash === '#-admin-s34-2343') {
        await F.toIt('setRoute', 'Admin');
        await F.toChild('Admin', 'setActive');
    }
    else if (hash === '#') {
        await F.toAct('SetRoute', 'Main');
        await F.toChild('Main', 'setActive');
    }
}
exports.routeToComp = routeToComp;
function authenticate(network, socialToken) {
    return fetch(config_1.getServer() + '/api/auth', {
        method: 'POST',
        headers: {
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            socialToken: socialToken,
        }),
    }).then(r => r.text());
}
exports.inputs = F => ({
    init: async () => {
        if (typeof window !== 'undefined') {
            let hash = utils_1.extractId(window.location.href);
            let route = hash.split('/')[0];
            if (window.ssrInitialized) {
                let components = window.ssrComponents;
                // TODO: handle nesting of components
                let name;
                for (name in components) {
                    F.ctx.components[name].state = fractal_core_1.deepmerge(F.ctx.components[name].state, components[name].state);
                }
            }
            await F.toIt('authenticate');
            routeToComp('#' + route, F);
        }
    },
    authenticate: async () => {
        hello.init({
            facebook: '257690644717021',
        }, {
            redirect_uri: 'redirect.html'
        });
        let token = localStorage.getItem('token');
        if (token) {
            try {
                await F.toIt('fetchUser', token);
                await F.toAct('SetToken', token);
                return;
            }
            catch (err) {
                if (err === '401') {
                    localStorage.removeItem('token');
                }
            }
        }
        hello.on('auth.login', auth => {
            hello(auth.network).api('me').then(profile => {
                let socialToken = auth.authResponse.access_token;
                authenticate(auth.network, socialToken).then(async (token) => {
                    if (token === '-1') {
                        return alert('Hay un problema, le daré solución prontamente');
                    }
                    if (token === '-2') {
                        return alert('Debes verificar tu cuenta de Facebook para poder acceder');
                    }
                    localStorage.setItem('token', token);
                    await F.toAct('SetToken', token);
                    // fbq('track', 'CompleteRegistration') // FB Pixel
                    try {
                        await F.toIt('fetchUser', token);
                    }
                    catch (err) {
                        if (err === '401') {
                            localStorage.removeItem('token');
                        }
                    }
                })
                    .catch((err) => {
                    console.clear();
                    console.error(err);
                    alert('Hay un problema, lo resolveré prontamente');
                });
            });
        });
        hello.on('auth.logout', async () => {
            await F.toAct('SetToken', '');
            localStorage.removeItem('token');
        });
    },
    fetchUser: async (token) => {
        try {
            let user = await fetch(config_1.getServer() + '/api/user', {
                headers: {
                    Authorization: 'Bearer ' + token,
                },
            })
                .then(function (response) {
                if (!response.ok) {
                    throw Error(response.status + '');
                }
                return response;
            })
                .then(r => r.json());
            await F.toChild('Dashboard', 'setTokenAndProfile', [token, user]);
            await F.toAct('SetPicture', user.fbData.pictureURL);
            await F.toAct('SetName', user.name);
            await F.toChild('Admin', 'setTokenAndProfile', [token, user]);
        }
        catch (err) {
            throw Error(err);
        }
    },
    setSection: async (name) => {
        await F.toAct('SetSection', name);
    },
    toRoute: async ([name, state]) => {
        if (name === '/') {
            await F.toAct('SetSection', 'Main');
            await F.toChild('Main', 'setActive');
        }
        else {
            await F.toChild('Site', 'setActive', Object.assign({ fetched: true }, state.state));
            await F.toAct('SetSection', 'Site');
        }
    },
    setRoute: async (route) => {
        await F.toAct('SetRoute', route);
    },
    // TODO: Remove side effect!
    setHash: async (hash) => {
        setTimeout(() => {
            window.location.href = '#';
            window.location.href = hash;
        }, 0);
        routeToComp(hash, F);
    },
    login: async () => {
        hello('facebook').login();
        await F.toIt('setHash', '#-panel');
    },
    logout: async () => {
        hello.logout('facebook');
        await F.toChild('Dashboard', 'logout');
        await F.toIt('setHash', '#');
        await F.toAct('SetToken', '');
        localStorage.removeItem('token');
    },
    $Dashboard_login: async () => await F.toIt('login'),
    $Main_login: async () => await F.toIt('login'),
});
exports.actions = {
    SetSection: fractal_core_1.assoc('section'),
    SetRoute: fractal_core_1.assoc('route'),
    SetToken: fractal_core_1.assoc('token'),
    SetPicture: fractal_core_1.assoc('picture'),
    SetName: fractal_core_1.assoc('name'),
};
const view = F => async (s) => {
    let style = fractal_core_1.getStyle(F);
    let loggedIn = s.token !== '';
    return s.section === 'Site'
        ? F.vw('Site')
        : s.section === 'Main' ? view_1.h('div', {
            key: F.ctx.name,
            class: style('base'),
        }, [
            view_1.h('header', {
                class: style('header'),
            }, [
                view_1.h('div', { class: style('titulo') }, [
                    view_1.h('img', {
                        class: style('tituloImagen'),
                        attrs: { src: 'assets/favicon.png', alt: 'startup colombia', itemprop: 'image' },
                    }),
                    view_1.h('h1', {
                        class: style('tituloText'),
                    }, 'Startup Colombia'),
                ]),
                view_1.h('div', { class: style('menu') }, [
                    ...loggedIn
                        ? [
                            view_1.h('div', { class: style('routes') }, [
                                ['Panel de Control', '#-panel', 'Dashboard'],
                                ['Lista', '#', 'Main'],
                            ].map(([op, hash, route]) => view_1.h('div', {
                                class: style('option', true, 'optionActive', route === s.route),
                                on: { click: F.in('setHash', hash) },
                            }, op))),
                        ]
                        : [],
                    view_1.h('div', { class: style('leftMenu') }, [
                        ...loggedIn
                            ? [
                                view_1.h('img', {
                                    class: style('picture'),
                                    attrs: {
                                        alt: s.name,
                                        title: s.name,
                                        src: s.picture,
                                    },
                                }),
                            ]
                            : [],
                        view_1.h('div', {
                            class: style('auth'),
                            on: { click: F.in(loggedIn ? 'logout' : 'login') },
                        }, loggedIn ? 'Salir' : 'Entrar'),
                    ]),
                ]),
            ]),
            view_1.h('div', { class: style('footer') }, [
                view_1.h('div', { class: style('footerAuthor') }, [
                    'Hecho con',
                    view_1.h('svg', {
                        class: style('HearthIcon'),
                        attrs: { viewBox: '0 0 200 200' },
                    }, [
                        view_1.h('path', {
                            class: style('HearthIconPath'),
                            attrs: {
                                d: 'm95.36899,50.0558c37.26498,-106.90773 183.27039,0 0,137.45279c-183.27039,-137.45279 -37.26498,-244.36052 0,-137.45279z',
                            },
                        }),
                    ]),
                    'por el equipo de ',
                    view_1.h('a', {
                        class: style('footerLink', true, 'footerPrimaryLink', true),
                        attrs: {
                            href: 'https://www.facebook.com/StartupsColombia/',
                            rel: 'noopener',
                            target: '_blank',
                        },
                    }, [
                        view_1.h('span', {}, 'Startup Colombia'),
                    ]),
                ]),
            ]),
            await F.vw(s.route),
        ])
            : view_1.h('p', {}, 'Sección no encontrada');
};
exports.interfaces = { view };
const style = {
    base: Object.assign({ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', color: constants_1.palette.textPrimary, overflowY: 'scroll' }, constants_1.textStyle),
    header: {
        flexShrink: 0,
        position: 'relative',
        width: '100%',
        height: '180px',
        padding: '30px 20px 30px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: constants_1.palette.primary,
        boxShadow: '0px 1px 1px 0px ' + constants_1.palette.shadowGrey,
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                flexDirection: 'column',
                paddingBottom: '10px',
            },
        },
    },
    titulo: {
        display: 'flex',
        alignItems: 'center',
    },
    tituloImagen: {
        width: '120px',
        height: 'auto',
        marginRight: '20px',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.md}px)`]: {
                width: '100px',
                marginRight: '10px',
            },
        },
    },
    tituloText: {
        margin: '0',
        paddingRight: '40px',
        fontSize: '42px',
        color: 'white',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.md}px)`]: {
                paddingRight: '0',
                fontSize: '38px',
            },
        },
    },
    menu: {
        position: 'absolute',
        top: '0px',
        right: '0px',
        padding: '5px',
        display: 'flex',
        alignItems: 'center',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                position: 'initial',
            },
        },
    },
    routes: {
        display: 'flex',
        paddingRight: '15px',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                padding: '10px 0 0 0',
            },
        },
    },
    option: Object.assign({ borderRadius: '2px', padding: '4px 8px', color: 'white', fontSize: '16px', fontWeight: 'bold' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.primaryLight,
            },
        } }),
    optionActive: {
        backgroundColor: constants_1.palette.primaryLight,
    },
    leftMenu: {
        display: 'flex',
        alignItems: 'center',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                position: 'absolute',
                top: '0px',
                right: '0px',
                padding: '5px',
            },
        },
    },
    picture: {
        width: '25px',
        height: '25px',
        borderRadius: '50%',
    },
    auth: Object.assign({ marginLeft: '10px', padding: '4px 7px', borderRadius: '2px', color: 'white', fontSize: '16px', fontWeight: 'bold' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.primaryLight,
            },
        } }),
    footer: {
        flexShrink: 0,
        order: 1,
        position: 'relative',
        marginTop: '13px',
        padding: '20px 0 10px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        backgroundColor: constants_1.palette.shadowLight,
        boxShadow: '0px -1px 1px 0px ' + constants_1.palette.shadowLighter,
    },
    footerAuthor: {
        padding: '15px 10px',
        fontSize: '16px',
        color: constants_1.palette.textTertiary,
        marginBottom: '4px',
    },
    HearthIcon: {
        width: '18px',
        height: '18px',
        margin: '0px 4px -3px 6px',
    },
    HearthIconPath: {
        fill: constants_1.palette.redCol,
    },
    footerLink: {
        padding: '4px',
        fontSize: '16px',
        textDecoration: 'none',
        $nest: {
            '&:hover': {
                textDecoration: 'underline',
            },
        },
    },
    footerPrimaryLink: {
        fontSize: '16px',
        color: constants_1.palette.primary,
    },
    partnerNotice: {
        position: 'absolute',
        bottom: '0',
        right: '0',
        padding: '5px',
        fontSize: '12px',
        color: constants_1.palette.textSecondary,
    },
    partner: {
        fontSize: '12px',
        color: constants_1.palette.textTertiary,
        padding: '4px',
        textDecoration: 'none',
        $nest: {
            '&:hover': {
                textDecoration: 'underline',
            },
        },
    },
};
exports.groups = { style };
//# sourceMappingURL=index.js.map
});
___scope___.file("app/Root/constants.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("fractal-core/core");
// Breakpoint responsive in pixels
exports.BP = {
    sm: 480,
    md: 768,
};
exports.textStyle = {
    fontFamily: '\'Open Sans\', sans-serif',
};
exports.palette = {
    primary: '#1A69EE',
    primaryLight: '#367AEC',
    secondary: '#ee6f1a',
    secondaryLight: '#f2832e',
    textPrimary: '#302f2f',
    textSecondary: '#404040',
    textTertiary: '#5c5657',
    shadowGrey: 'rgba(197,207,235,1)',
    shadowLight: '#e8e7e7',
    shadowLighter: '#f2f2f2',
    borderLight: '#bfbfbf',
    borderGrey: '#ada8a9',
    // qualify
    red: '#ee1a1a',
    yellow: '#eed91a',
    green: '#45ee1a',
    // Colombia related
    redCol: '#CE1126',
};
exports.createBtnStyle = (mainColor, lightColor, textColor) => (Object.assign({ padding: '8px 10px', borderRadius: '4px', fontSize: '20px', color: textColor, backgroundColor: mainColor, border: 'none', outline: 'none' }, core_1.absoluteCenter, core_1.clickable, { $nest: {
        '&:hover': {
            backgroundColor: lightColor,
        },
        '&:focus': {
            backgroundColor: lightColor,
        },
    } }));
exports.buttonPrimaryStyle = exports.createBtnStyle(exports.palette.primary, exports.palette.primaryLight, 'white');
exports.buttonCancelStyle = exports.createBtnStyle(exports.palette.shadowLighter, exports.palette.shadowLight, exports.palette.textSecondary);
exports.scrollBar = {
    $nest: {
        '&::-webkit-scrollbar': {
            width: '12px',
            height: '12px',
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: exports.palette.shadowLighter,
            borderRadius: '7px',
        },
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: exports.palette.borderLight,
            borderRadius: '7px',
        },
    },
};
exports.simpleInput = Object.assign({}, exports.textStyle, { width: '80%', margin: '5px 0', minWidth: '300px', padding: '8px', fontSize: '18px', outline: 'none', border: 'none', color: exports.palette.textPrimary, borderBottom: '1px solid ' + exports.palette.borderLight, $nest: {
        '&:focus': {
            borderBottom: '1px solid ' + exports.palette.primary,
        },
    } });
//# sourceMappingURL=constants.js.map
});
___scope___.file("app/Root/Main.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const constants_1 = require("./constants");
const utils_1 = require("../utils");
const config_1 = require("../config");
const structuredData = view_1.h('script', { attrs: { type: 'application/ld+json' } }, `
{
  "@graph": [
    {
      "@context": "http://schema.org",
      "@type": "WebSite",
      "name": "Startup Colombia",
      "url": "https://startupcol.com/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://startupcol.com/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "http://schema.org",
      "@type": "Organization",
      "url": "https://startupcol.com/",
      "logo": "https://startupcol.com/assets/favicon.png"
    }
  ]
}
`);
exports.meta = {
    title: 'Startup Colombia - Comunidad de empresas de base tecnológica',
    description: 'Founders intercambiando experiencias y aprendizajes. Comuniad de empresas de base tecnologica.',
    keywords: 'empresas colombianas,startup colombia,comunidad de empresas colombianas,startups colombianas,comunidad de startups',
};
const Company = require("./common/Company");
exports.components = {
    Company1: fractal_core_1.clone(Company),
    Company2: fractal_core_1.clone(Company),
    Company3: fractal_core_1.clone(Company),
};
exports.state = {
    online: true,
    searchState: 'wait',
    searchTimeout: -1,
    companiesPerPage: 20,
    page: 0,
    pages: [''],
    maxPages: 1,
    searchText: '',
    searchFilter: 'all',
    filteredCompanies: [],
    initialized: false,
    companiesCount: 0,
    randomFetched: false,
    _nest: exports.components,
    _compUpdated: false,
};
let filterOptions = [
    ['all', 'General'],
    ['tags', 'Por categorías'],
    ['name', 'Por nombre'],
    ['places', 'Por lugares'],
    ['user', 'Por usuario'],
];
exports.setSearchString = (text, filterName) => {
    utils_1.changeSearchString(`q=${encodeURIComponent(text)}&filter=${encodeURIComponent(filterName)}`);
};
exports.inputs = F => ({
    initEmpresas: async ([empresas, maxCompanies, bookmark]) => {
        let empresasVisible = fractal_core_1.clone(empresas);
        await F.toIt('setFilteredCompanies', [fractal_core_1.clone(empresasVisible), maxCompanies, bookmark]);
    },
    setFilteredCompanies: async ([empresas, maxCompanies, bookmark]) => {
        await F.toAct('SetBookmark', bookmark);
        await F.toAct('SetFilteredCompanies', [fractal_core_1.clone(empresas), maxCompanies]);
        var i = 0, empresaNext;
        async function addCompany(empresa) {
            await F.toAct('AddCompany', empresa._id);
            await F.toChild(empresa._id, 'setState', empresa, true);
            i++;
            empresaNext = empresas[i];
            if (empresaNext) {
                await addCompany(empresaNext);
            }
        }
        if (empresas[0]) {
            await addCompany(empresas[0]);
        }
    },
    setPage: async (num) => {
        let s = F.stateOf();
        await F.toAct('SetPage', num);
        utils_1.search(s.searchText, s.searchFilter, s.pages[s.page], s.companiesPerPage)
            .then(async ([empresas, maxCompanies, bookmark]) => {
            await F.toIt('initEmpresas', [empresas, maxCompanies, bookmark]);
            await F.toIt('scrollTop');
        })
            .catch(err => { });
    },
    setActive: async () => {
        if (typeof window !== 'undefined') {
            let search = window.location.search.substr(1);
            if (search !== '') {
                let parts = search.split('&');
                let searchObj = { q: '', filter: 'all' };
                for (let i = 0, part; part = parts[i]; i++) {
                    let subParts = part.split('=');
                    searchObj[subParts[0]] = subParts[1];
                }
                if (searchObj.q === '') {
                    await F.toIt('randomCompanies');
                }
                let text = decodeURIComponent(searchObj.q);
                let filterName = decodeURIComponent(searchObj.filter);
                await F.toAct('SetSearchFilter', filterName);
                await F.toAct('SetSearchFilter', filterName);
                await F.toAct('SetSearchText', text);
                await F.toIt('search', text);
            }
            else {
                if (F.stateOf().filteredCompanies.length > 0) {
                    await F.toAct('SetSearchText', '');
                    await F.toIt('setFilteredCompanies', []);
                }
                await F.toIt('randomCompanies');
            }
        }
    },
    scrollTop: async () => {
        document.querySelector('#app div').scrollTop = 0;
    },
    searchInputKeyup: async (text) => {
        text = text.trim();
        if (text === '') {
            await F.toAct('SetSearchText', '');
            exports.setSearchString('', 'all');
            await F.toIt('initEmpresas', [[], 0, '']);
            await F.toIt('randomCompanies');
            return;
        }
        F.toAct('SetRandomFetched', false);
        let s = F.stateOf();
        if (s.searchState === 'wait') {
            await F.toAct('SetSearchState', 'ignore');
            await F.toAct('SetSearchText', text);
            s.searchTimeout = setTimeout(async () => {
                await F.toAct('SetSearchState', 'ready');
                await F.toIt('searchInputKeyup', s.searchText);
            }, 400);
        }
        else if (s.searchState === 'ready') {
            await F.toIt('search', text);
            await F.toAct('SetSearchState', 'wait');
            s.searchTimeout = -1;
        }
        else {
            clearTimeout(s.searchTimeout);
            await F.toAct('SetSearchText', text);
            s.searchTimeout = setTimeout(async () => {
                await F.toAct('SetSearchState', 'ready');
                await F.toIt('searchInputKeyup', s.searchText);
            }, 400);
        }
    },
    searchFilterChange: async (idx) => {
        await F.toAct('SetSearchFilter', filterOptions[idx][0]);
        await F.toIt('search', F.stateOf().searchText);
    },
    search: async (text) => {
        let s = F.stateOf();
        utils_1.search(text, s.searchFilter, '', s.companiesPerPage)
            .then(async ([companies, maxCompanies, bookmark]) => {
            await F.toAct('SetOnline', true);
            await F.toIt('initEmpresas', [companies, maxCompanies, bookmark]);
            exports.setSearchString(text, s.searchFilter);
            if (s.initialized) {
                window.location.hash = '';
            }
            else {
                utils_1.refreshHashScroll();
                await F.toAct('SetInitialized', true);
            }
        })
            .catch(() => F.toAct('SetOnline', false));
    },
    randomCompanies: async () => {
        await F.toAct('SetOnline', true);
        fetch(config_1.cloudantURL + '/companies')
            .then(r => r.json())
            .then(res => {
            F.toAct('SetCompaniesCount', Math.floor(res.doc_count / 10) * 10);
            fetch(config_1.cloudantURL + '/companies/_all_docs')
                .then(r => r.json())
                .then(({ rows }) => {
                let last;
                for (let i = 0; i < 3; i++) {
                    let idx = Math.ceil(Math.random() * res.doc_count);
                    while (idx === last) {
                        idx = Math.ceil(Math.random() * res.doc_count);
                    }
                    fetch(config_1.cloudantURL + '/companies/' + rows[idx].id)
                        .then(r => r.json())
                        .then(async (doc) => {
                        await F.toChild('Company' + (i + 1), 'setState', doc);
                        if (i === 2) {
                            await F.toAct('SetRandomFetched', true);
                        }
                    });
                    last = idx;
                }
            }).catch(() => F.toAct('SetOnline', false));
        }).catch(() => F.toAct('SetOnline', false));
    },
    $_setFilter: async ([comp, [filterName, text]]) => {
        await F.toIt('scrollTop');
        await F.toAct('SetSearchFilter', filterName);
        await F.toAct('SetSearchText', text);
        exports.setSearchString(text, filterName);
        await F.toIt('search', text);
    },
    login: async () => { },
});
exports.actions = {
    SetOnline: fractal_core_1.assoc('online'),
    SetPage: fractal_core_1.assoc('page'),
    AddCompany: id => s => {
        s._nest[id] = Company;
        s._compUpdated = true;
        return s;
    },
    SetBookmark: bookmark => s => {
        if (!s.pages[s.page + 1]) {
            s.pages[s.page + 1] = bookmark;
        }
        return s;
    },
    NextPage: () => s => {
        if (s.page < s.maxPages) {
            s.page++;
        }
        return s;
    },
    SetSearchText: text => s => {
        s.searchText = text;
        s.pages = [''];
        return s;
    },
    SetSearchState: fractal_core_1.assoc('searchState'),
    SetSearchFilter: text => s => {
        s.searchFilter = text;
        s.pages = [''];
        return s;
    },
    SetFilteredCompanies: ([filteredCompanies, maxCompanies]) => s => {
        s.filteredCompanies = filteredCompanies;
        s.maxPages = Math.ceil(maxCompanies / s.companiesPerPage);
        return s;
    },
    SetInitialized: fractal_core_1.assoc('initialized'),
    SetCompaniesCount: fractal_core_1.assoc('companiesCount'),
    SetRandomFetched: fractal_core_1.assoc('randomFetched'),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return view_1.h('article', {
        key: F.ctx.id,
        class: { [style.base]: true },
    }, [
        view_1.h('header', { class: { [style.header]: true } }, [
            // h('h2', {
            //   class: { [style.titulo]: true },
            //   attrs: { itemprop: 'applicationCategory' },
            // }, 'Lista de Empresas'),
            view_1.h('p', { class: { [style.descripcion]: true } }, [
                'Comunidad de empresas de base tecnológica',
            ]),
            view_1.h('button', {
                class: { [style.authBtn]: true },
                on: { click: F.in('login') },
            }, '¡Unete!'),
        ]),
        view_1.h('input', {
            class: { [style.searchInput]: true },
            attrs: { type: 'text', placeholder: 'Busca en nuestra lista de empresas' },
            props: { value: s.searchText },
            on: {
                keyup: F.in('searchInputKeyup', fractal_core_1._, ['target', 'value']),
            },
        }),
        view_1.h('div', { class: { [style.empresas]: true } }, [
            ...!s.online
                ? [view_1.h('div', { class: { [style.empresasVacio]: true } }, 'No hay conexión')]
                : s.filteredCompanies.length === 0 && s.searchText !== ''
                    ? [view_1.h('div', { class: { [style.empresasVacio]: true } }, '. . .')]
                    : s.searchText === ''
                        ? []
                        : await fractal_core_1.mapAsync(s.filteredCompanies, async (empresa, idx) => await F.vw(empresa._id)),
        ]),
        ...s.searchText !== '' ? [view_1.h('div', { class: { [style.pages]: true } }, [
                ...s.pages.filter((page, idx) => idx < s.maxPages).map((bookmark, idx) => view_1.h('div', {
                    class: {
                        [style.pageNumber]: true,
                        [style.pageNumberActive]: idx === s.page,
                    },
                    on: { click: F.in('setPage', idx) },
                }, idx + 1 + '')),
                view_1.h('div', {
                    class: { [style.nextMessage]: true },
                }, `... ${s.maxPages} páginas`),
            ])] : [],
        structuredData,
        ...s.randomFetched ? [
            view_1.h('div', { class: { [style.randomContainer]: true } }, [
                view_1.h('div', { class: { [style.randomDescription]: true } }, `Aquí una muestra. Somos más de ${s.companiesCount} empresas!`),
                await F.vw('Company1'),
                await F.vw('Company2'),
                await F.vw('Company3'),
                view_1.h('div', { class: { [style.moreRandomContainer]: true } }, [
                    view_1.h('button', {
                        class: { [style.moreRandomBtn]: true },
                        on: { click: F.in('randomCompanies') },
                    }, 'Quiero más!'),
                ]),
            ]),
        ] : [],
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        flexShrink: 0,
        minHeight: 'calc(100% - 249px)',
        paddingBottom: '50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    header: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    titulo: {
        margin: '30px 0 10px 0',
        fontSize: '28px',
        color: constants_1.palette.secondary,
    },
    descripcion: {
        maxWidth: '800px',
        textAlign: 'center',
        lineHeight: '1.5em',
        fontSize: '24px',
        margin: '25px 10px 25px 10px',
        color: constants_1.palette.textPrimary,
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                marginBottom: '20px',
            },
        },
    },
    authBtn: Object.assign({ marginBottom: '20px', padding: '10px 15px', background: 'none', border: 'none', fontSize: '28px', color: 'white', borderRadius: '5px', backgroundColor: constants_1.palette.secondary }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.secondaryLight,
            },
        } }),
    searchInput: Object.assign({ width: '95%', maxWidth: '500px', paddingBottom: '10px', border: 'none', fontSize: '28px', textAlign: 'center', color: constants_1.palette.textPrimary, borderBottom: '1px solid ' + constants_1.palette.borderLight, outline: 'none' }, constants_1.textStyle, { $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                minWidth: '310px',
                margin: '0 10px 20px 10px',
                textAlign: 'center',
                padding: '0 10px',
            },
        } }),
    empresas: {
        width: '100%',
        maxWidth: '484px',
    },
    empresasVacio: {
        textAlign: 'center',
        fontSize: '30px',
    },
    pages: {
        marginTop: '20px',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
    },
    pageNumber: Object.assign({ margin: '2px', padding: '5px 7px', borderRadius: '4px', textDecoration: 'underline' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.shadowLight,
            },
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                padding: '8px 12px',
                fontSize: '20px',
                textDecoration: 'none',
            },
        } }),
    pageNumberActive: {
        backgroundColor: constants_1.palette.shadowLight,
    },
    nextMessage: {
        margin: '2px',
        padding: '5px 7px',
    },
    randomContainer: {
        marginTop: '30px',
    },
    randomDescription: {
        textAlign: 'center',
        padding: '5px 10px',
    },
    moreRandomContainer: {
        padding: '25px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    moreRandomBtn: Object.assign({ padding: '8px' }, constants_1.textStyle, { fontSize: '20px', border: '1px solid ' + constants_1.palette.borderLight, borderRadius: '4px', backgroundColor: 'white', color: constants_1.palette.textSecondary, outline: 'none' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.shadowLight,
            },
        } }),
};
exports.groups = { style };
//# sourceMappingURL=Main.js.map
});
___scope___.file("app/Root/common/Company.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const constants_1 = require("../constants");
const utils_1 = require("../../utils");
exports.state = {
    _id: '',
    name: '',
    description: '',
    webpage: '',
    webpageName: '',
    networks: {
        facebook: '',
    },
    userFb: '',
    user: '',
    userId: '',
    tags: [],
    places: [],
};
exports.inputs = F => ({
    setState: async (s) => {
        await F.toAct('SetState', s);
    },
    setFilter: async ([filterName, text]) => { },
    toSite: async (s) => {
        let id = utils_1.strToLink(s.name);
        await F.runIt(['route', ['/' + id, s]]);
    },
});
exports.actions = {
    SetState: company => s => {
        let merged = fractal_core_1.deepmerge(fractal_core_1.clone(exports.state), company);
        merged.webpageName = merged.webpage.split('/')[2];
        return merged;
    },
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    let mainURL = s.webpage
        ? s.webpage
        : s.networks.facebook
            ? s.networks.facebook
            : s.userFb
                ? s.userFb
                : 'https://facebook.com/' + s.userId;
    return view_1.h('div', {
        key: F.ctx.id,
        class: { [style.base]: true },
    }, [
        view_1.h('a', {
            key: 'title',
            class: { [style.title]: true },
            attrs: {
                href: mainURL,
                target: '_blank',
                rel: 'nofollow noopener noreferrer',
            },
        }, s.name),
        ...s.description ? [
            view_1.h('div', { key: 'description', class: { [style.description]: true } }, s.description),
        ] : [],
        view_1.h('div', {
            key: 'container',
            class: { [style.dataContainer]: true },
        }, [
            ...s.webpage ? [
                view_1.h('a', {
                    key: 'webpage',
                    class: {
                        [style.webpage]: true,
                        [style.link]: true,
                    },
                    attrs: {
                        href: s.webpage,
                        rel: 'nofollow noopener noreferrer',
                        target: '_blank',
                    },
                }, s.webpageName)
            ] : [],
            ...s.networks.facebook ? [
                view_1.h('a', {
                    key: 'fanpage',
                    class: {
                        [style.fanpage]: true,
                        [style.link]: true,
                    },
                    attrs: {
                        href: s.networks.facebook,
                        rel: 'nofollow noopener noreferrer',
                        target: '_blank',
                    },
                }, 'Fanpage')
            ] : [],
            view_1.h('a', {
                class: {
                    [style.user]: true,
                    [style.link]: true,
                },
                attrs: {
                    href: s.userFb ? s.userFb : 'https://facebook.com/' + s.userId,
                    rel: 'nofollow noopener noreferrer',
                    target: '_blank',
                },
            }, s.user),
        ]),
        s.places ? view_1.h('div', {
            class: { [style.places]: true },
            on: { click: F.in('setFilter', ['places', s.places[0]]) },
        }, s.places[0]) : view_1.h('div'),
        s.tags ? view_1.h('div', { class: { [style.tags]: true } }, s.tags.map(tagName => view_1.h('div', {
            class: { [style.tag]: true },
            on: { click: F.in('setFilter', ['tags', tagName]) },
        }, tagName))) : view_1.h('div'),
        view_1.h('a', {
            class: { [style.moreLink]: true },
            attrs: { href: '/' + utils_1.strToLink(s.name) },
            on: { click: F.in('toSite', s, fractal_core_1._, { default: false }) },
        }, 'ver más...'),
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        position: 'relative',
        width: '100%',
        maxWidth: '484px',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 0 15px 0',
        alignItems: 'center',
        borderBottom: '1px solid ' + constants_1.palette.borderLight,
    },
    title: {
        margin: '0',
        padding: '10px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: constants_1.palette.textPrimary,
        fontSize: '24px',
        textAlign: 'center',
        textDecoration: 'none',
        cursor: 'pointer',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                maxWidth: '245px',
                width: '100%',
                padding: '10px 0',
                fontSize: '20px',
            },
            '&:hover': {
                textDecoration: 'underline',
            },
        },
    },
    description: {
        maxWidth: '93%',
        padding: '5px 10px 10px 10px',
        fontSize: '16px',
        textAlign: 'center',
        color: constants_1.palette.textSecondary,
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                maxWidth: '100%',
                padding: '5px 4px 10px 4px',
                fontSize: '14px',
            },
        },
    },
    dataContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
            width: '100%',
        },
    },
    link: Object.assign({ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '5px 8px', textDecoration: 'none', borderRadius: '4px' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.shadowLight,
            },
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                width: '90%',
                padding: '8px 8px',
                textAlign: 'center',
            },
        } }),
    webpage: {
        color: constants_1.palette.primary,
    },
    fanpage: {
        color: constants_1.palette.primary,
    },
    user: {
        color: constants_1.palette.textTertiary,
    },
    places: Object.assign({ marginTop: '8px', marginBottom: '2px', padding: '4px 6px', borderRadius: '4px', fontSize: '14px', color: constants_1.palette.textTertiary }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.shadowLight,
            },
        } }),
    tags: {
        maxWidth: '85%',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    tag: Object.assign({ margin: '3px', padding: '3px', borderRadius: '4px', fontSize: '14px', color: constants_1.palette.textTertiary, border: '1px solid ' + constants_1.palette.borderGrey }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.shadowLight,
            },
        } }),
    moreLink: Object.assign({ position: 'absolute', bottom: '0px', right: '0px', fontSize: '14px', color: constants_1.palette.textTertiary, textDecoration: 'none' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                textDecoration: 'underline',
            },
        } }),
};
exports.groups = { style };
//# sourceMappingURL=Company.js.map
});
___scope___.file("app/Root/Dashboard/index.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const config_1 = require("../../config");
const constants_1 = require("../constants");
const NewCompany = require("./NewCompany");
const ModifyCompany = require("./ModifyCompany");
const Company = require("../common/Company");
const alertNoPanic = () => alert('Algo esta mal, estoy trabajando para solucionarlo');
exports.components = {
    NewCompany,
    ModifyCompany,
};
exports.state = {
    fetched: false,
    token: '',
    profile: {
        name: '',
        email: '',
    },
    companies: [],
    activeModal: '',
    _nest: exports.components,
    _compUpdated: false,
};
exports.inputs = F => ({
    setActive: async () => {
        let s = F.stateOf();
        if (s.token) {
            await F.toIt('fetchCompanies');
        }
    },
    login: async () => { },
    logout: async () => await F.toAct('SetToken', ''),
    setTokenAndProfile: async ([token, profile]) => {
        await F.toAct('SetToken', token);
        await F.toAct('SetProfile', profile);
        await F.toIt('fetchCompanies');
    },
    fetchCompanies: async () => {
        try {
            let res = await fetch(config_1.getServer() + '/api/companies', {
                headers: {
                    Authorization: 'Bearer ' + F.stateOf().token,
                },
            }).then(r => r.json());
            await F.toAct('Fetched');
            if (res.code < 0) {
                return alertNoPanic();
            }
            await F.toIt('setCompanies', res);
        }
        catch (err) {
            alertNoPanic();
        }
    },
    activeNewCompany: async () => {
        let s = F.stateOf();
        await F.toChild('NewCompany', 'setActive', [s.token, s.profile]);
        await F.toAct('SetActiveModal', 'NewCompany');
    },
    $NewCompany_close: async () => F.toAct('SetActiveModal', ''),
    $NewCompany_companyAdded: async (company) => {
        if (company._userEmail) {
            await F.toAct('SetEmail', company._userEmail);
        }
    },
    $ModifyCompany_close: async () => {
        await F.toAct('SetActiveModal', '');
        await F.toIt('fetchCompanies');
    },
    setCompanies: async (companies) => {
        await F.toAct('SetCompanies', companies);
        for (let i = 0, comp; comp = companies[i]; i++) {
            await F.toChild(comp._id, 'setState', comp);
        }
    },
    activeModifyCompany: async (company) => {
        let s = F.stateOf();
        await F.toChild('ModifyCompany', 'setActive', [s.token, s.profile]);
        await F.toChild('ModifyCompany', 'setCompany', company);
        await F.toAct('SetActiveModal', 'ModifyCompany');
    },
});
exports.actions = {
    Fetched: () => fractal_core_1.assoc('fetched')(true),
    SetToken: fractal_core_1.assoc('token'),
    SetProfile: fractal_core_1.assoc('profile'),
    SetEmail: email => s => {
        s.profile.email = email;
        return s;
    },
    SetCompanies: companies => s => {
        for (let i = 0, company; company = companies[i]; i++) {
            s._nest[company._id] = fractal_core_1.clone(Company);
        }
        s.companies = companies;
        s._compUpdated = true;
        return s;
    },
    SetActiveModal: fractal_core_1.assoc('activeModal'),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return s.token !== ''
        ? view_1.h('article', { class: { [style.base]: true } }, [
            ...s.activeModal !== '' ? [view_1.h('div', {
                    class: {
                        [style.modal]: true,
                    },
                    on: { click: F.act('SetActiveModal', '') },
                }, [
                    await F.vw(s.activeModal),
                ])] : [],
            view_1.h('h1', { class: { [style.title]: true } }, `¡Hola ${s.profile.name}!`),
            !s.fetched
                ? view_1.h('div', { class: { [style.description]: true } }, '. . .')
                : view_1.h('div', { class: { [style.container]: true } }, [
                    view_1.h('button', {
                        class: { [style.addCompanyBtn]: true },
                        on: { click: F.in('activeNewCompany') },
                    }, 'Agregar Empresa'),
                    view_1.h('div', { class: { [style.companies]: true } }, [
                        view_1.h('div', { class: { [style.companiesTitle]: true } }, 'Empresas'),
                        ...await fractal_core_1.mapAsync(s.companies, async (company) => view_1.h('div', { class: { [style.companyContainer]: true } }, [
                            await F.vw(company._id),
                            view_1.h('svg', {
                                class: { [style.modifyCompanyBtn]: true },
                                attrs: { viewBox: '0 0 268.765 268.765' },
                                on: { click: F.in('activeModifyCompany', company) },
                            }, [
                                view_1.h('path', {
                                    attrs: {
                                        d: 'M267.92,119.461c-0.425-3.778-4.83-6.617-8.639-6.617 c-12.315,0-23.243-7.231-27.826-18.414c-4.682-11.454-1.663-24.812,7.515-33.231c2.889-2.641,3.24-7.062,0.817-10.133 c-6.303-8.004-13.467-15.234-21.289-21.5c-3.063-2.458-7.557-2.116-10.213,0.825c-8.01,8.871-22.398,12.168-33.516,7.529 c-11.57-4.867-18.866-16.591-18.152-29.176c0.235-3.953-2.654-7.39-6.595-7.849c-10.038-1.161-20.164-1.197-30.232-0.08 c-3.896,0.43-6.785,3.786-6.654,7.689c0.438,12.461-6.946,23.98-18.401,28.672c-10.985,4.487-25.272,1.218-33.266-7.574    c-2.642-2.896-7.063-3.252-10.141-0.853c-8.054,6.319-15.379,13.555-21.74,21.493c-2.481,3.086-2.116,7.559,0.802,10.214    c9.353,8.47,12.373,21.944,7.514,33.53c-4.639,11.046-16.109,18.165-29.24,18.165c-4.261-0.137-7.296,2.723-7.762,6.597    c-1.182,10.096-1.196,20.383-0.058,30.561c0.422,3.794,4.961,6.608,8.812,6.608c11.702-0.299,22.937,6.946,27.65,18.415    c4.698,11.454,1.678,24.804-7.514,33.23c-2.875,2.641-3.24,7.055-0.817,10.126c6.244,7.953,13.409,15.19,21.259,21.508    c3.079,2.481,7.559,2.131,10.228-0.81c8.04-8.893,22.427-12.184,33.501-7.536c11.599,4.852,18.895,16.575,18.181,29.167    c-0.233,3.955,2.67,7.398,6.595,7.85c5.135,0.599,10.301,0.898,15.481,0.898c4.917,0,9.835-0.27,14.752-0.817    c3.897-0.43,6.784-3.786,6.653-7.696c-0.451-12.454,6.946-23.973,18.386-28.657c11.059-4.517,25.286-1.211,33.281,7.572    c2.657,2.89,7.047,3.239,10.142,0.848c8.039-6.304,15.349-13.534,21.74-21.494c2.48-3.079,2.13-7.559-0.803-10.213    c-9.353-8.47-12.388-21.946-7.529-33.524c4.568-10.899,15.612-18.217,27.491-18.217l1.662,0.043    c3.853,0.313,7.398-2.655,7.865-6.588C269.044,139.917,269.058,129.639,267.92,119.461z M134.595,179.491    c-24.718,0-44.824-20.106-44.824-44.824c0-24.717,20.106-44.824,44.824-44.824c24.717,0,44.823,20.107,44.823,44.824    C179.418,159.385,159.312,179.491,134.595,179.491z',
                                    },
                                }),
                            ]),
                        ])),
                    ]),
                ]),
        ])
        : view_1.h('article', { class: { [style.base]: true } }, [
            view_1.h('div', { class: { [style.title]: true } }, 'Bienvenido!'),
            view_1.h('button', {
                class: { [style.login]: true },
                on: { click: F.in('login') },
            }, 'Entrar'),
        ]);
};
exports.interfaces = { view };
const style = {
    base: {
        flexShrink: 0,
        width: '100%',
        minHeight: 'calc(100% - 249px)',
        paddingBottom: '50px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    modal: {
        position: 'fixed',
        zIndex: 99,
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    title: {
        margin: '30px 0 25px 0',
        textAlign: 'center',
        fontSize: '28px',
        fontWeight: 'normal',
        color: constants_1.palette.secondary,
    },
    container: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    description: {
        textAlign: 'center',
        fontSize: '18px',
    },
    login: fractal_core_1.deepmerge(constants_1.buttonPrimaryStyle, { width: '130px' }),
    addCompanyBtn: constants_1.buttonPrimaryStyle,
    companies: {
        marginTop: '30px',
        width: '90%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                width: '100%',
            },
        },
    },
    companiesTitle: {
        width: '500px',
        padding: '0 20px 15px 20px',
        textAlign: 'center',
        fontSize: '24px',
        color: constants_1.palette.secondary,
        borderBottom: '1px solid ' + constants_1.palette.borderLight,
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                width: '90%',
            },
        },
    },
    companyContainer: {
        position: 'relative',
        width: '500px',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                width: '90%',
            },
        },
    },
    modifyCompanyBtn: Object.assign({ position: 'absolute', bottom: '4px', left: '2px', width: '35px', height: '35px', padding: '3px', fill: constants_1.palette.primary, border: '1px solid rgba(0, 0, 0, 0)', borderRadius: '4px' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                fill: constants_1.palette.primaryLight,
                border: '1px solid ' + constants_1.palette.borderLight,
            },
        } }),
};
exports.groups = { style };
//# sourceMappingURL=index.js.map
});
___scope___.file("app/Root/Dashboard/NewCompany.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const config_1 = require("../../config");
const constants_1 = require("../constants");
const CompanyForm = require("../common/CompanyForm");
const TextInput = require("../common/TextInput");
exports.components = {
    CompanyForm: fractal_core_1.pipe(fractal_core_1.props({ mode: 'request' }), fractal_core_1.styles({ base: { marginTop: '5px' } }))(fractal_core_1.clone(CompanyForm)),
    email: fractal_core_1.pipe(fractal_core_1.styles({ base: { width: '80%' } }), fractal_core_1.props({ hint: 'Tu email aquí' }))(fractal_core_1.clone(TextInput)),
};
exports.state = {
    token: '',
    datos: {
        code: 0,
        state: '',
    },
    profile: {
        name: '',
        email: '',
    },
    _nest: exports.components,
};
exports.inputs = F => ({
    setActive: async ([token, profile]) => {
        await F.toAct('SetToken', token);
        await F.toAct('SetProfile', profile);
        await F.toChild('CompanyForm', 'setActive');
    },
    cancel: async () => {
        await F.toChild('CompanyForm', 'reset');
        await F.toChild('email', 'change', '');
        await F.toIt('close');
    },
    addCompany: async () => {
        await F.toChild('CompanyForm', 'getData');
    },
    $CompanyForm_data: async (company) => {
        let s = F.stateOf();
        if (!s.profile.email) {
            ;
            company._userEmail = F.stateOf('email').value;
            if (!company._userEmail) {
                await F.toChild('email', 'setError', true);
                alert('Déjame tu email de contacto personal, te avisaré cuando tu empresa sea añadida y cuando implemente nuevas características en la plataforma');
                return;
            }
        }
        try {
            let res = await fetch(config_1.getServer() + '/api/companyRequest', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + s.token,
                    Accept: 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(company),
            }).then(r => r.json());
            if (res.code === 0) {
                await F.toChild('CompanyForm', 'reset');
                await F.toChild('email', 'setError', false);
                await F.toChild('email', 'change', '');
                await F.toIt('close');
                await F.toIt('companyAdded', company);
                alert('Tu solicitud fue enviada... la revisaré y te contactaré prontamente');
            }
            else {
                alert('Hay un problema, estoy trabajando en darle pronta solución');
            }
        }
        catch (err) {
            alert('No hay conexión o hay un error, puedes escribirme si el problema persiste');
        }
    },
    $CompanyForm_validationError: async () => {
        alert('Debes completar el formulario');
    },
    companyAdded: async () => { },
    close: async () => { },
});
exports.actions = {
    SetToken: fractal_core_1.assoc('token'),
    SetProfile: fractal_core_1.assoc('profile'),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return view_1.h('div', {
        key: F.ctx.name,
        class: { [style.base]: true },
        on: { click: 'ignore' },
    }, [
        view_1.h('div', {
            class: { [style.closeBtn]: true },
            on: { click: F.in('close') },
        }, 'x'),
        view_1.h('div', { class: { [style.container]: true } }, [
            ...!s.profile.email ? [
                view_1.h('div', { class: { [style.emailForm]: true } }, [
                    view_1.h('div', { class: { [style.emailText]: true } }, 'Escribe tu email, te avisaré cuando tu empresa sea añadida y cuando implemente nuevas características en la plataforma*'),
                    await F.vw('email'),
                ]),
            ] : [],
            view_1.h('div', { class: { [style.emailText]: true } }, 'Datos de la empresa'),
            await F.vw('CompanyForm'),
            view_1.h('div', { class: { [style.buttonContainer]: true } }, [
                view_1.h('button', {
                    class: { [style.cancelBtn]: true },
                    on: { click: F.in('cancel') },
                }, 'Cancelar'),
                view_1.h('button', {
                    class: { [style.addCompanyBtn]: true },
                    on: { click: F.in('addCompany') },
                }, 'Agregar'),
            ]),
        ]),
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        position: 'relative',
        height: '90%',
        borderRadius: '7px',
        backgroundColor: 'white',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                height: '100%',
                borderRadius: '0',
            },
        },
    },
    container: Object.assign({ width: '100%', height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'scroll' }, constants_1.scrollBar),
    emailForm: {
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 0 10px 0',
    },
    emailText: {
        maxWidth: '500px',
        padding: '0 20px 5px 20px',
        textAlign: 'center',
        fontSize: '18px',
    },
    initialInput: {
        marginTop: '10px',
    },
    finalInput: {
        marginBottom: '15px',
    },
    companyForm: {
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    buttonContainer: {
        flexShrink: 0,
        display: 'flex',
        margin: '24px 15px 15px 15px',
    },
    cancelBtn: fractal_core_1.deepmerge(constants_1.buttonCancelStyle, {
        marginRight: '35px',
    }),
    addCompanyBtn: constants_1.buttonPrimaryStyle,
    closeBtn: Object.assign({ position: 'absolute', right: '-12px', top: '-12px', width: '24px', height: '24px', fontSize: '16px', borderRadius: '50%', background: 'white', boxShadow: '0 0 1px 1px ' + constants_1.palette.borderLight }, fractal_core_1.clickable, fractal_core_1.absoluteCenter),
};
exports.groups = { style };
//# sourceMappingURL=NewCompany.js.map
});
___scope___.file("app/Root/common/CompanyForm.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const constants_1 = require("../constants");
const utils_1 = require("../../utils");
const TextInput = require("./TextInput");
const TextArea = require("./TextArea");
exports.emptyCompany = {
    id: '',
    type: 'micro',
    user: '',
    userId: '',
    tags: [],
    places: [],
    isStartup: false,
    error: false,
};
let textFieldStyle = {
    base: {
        width: '80%',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                width: '95%',
            },
        },
    },
};
let FormTextInput = fractal_core_1.styles(textFieldStyle)(fractal_core_1.clone(TextInput));
exports.components = {
    name: fractal_core_1.props({ hint: 'Nombre de tu empresa*', attrs: { list: 'companiesData' } })(fractal_core_1.clone(FormTextInput)),
    email: fractal_core_1.props({ hint: 'Email de Contacto*' })(fractal_core_1.clone(FormTextInput)),
    description: fractal_core_1.pipe(fractal_core_1.styles(textFieldStyle), fractal_core_1.props({
        hint: '¿Qué hace tu empresa?* (155 max)',
        attrs: { maxlength: 155, rows: 5 },
    }))(fractal_core_1.clone(TextArea)),
    webpage: fractal_core_1.props({ hint: 'Página web' })(fractal_core_1.clone(FormTextInput)),
    facebook: fractal_core_1.props({ hint: 'Facebook' })(fractal_core_1.clone(FormTextInput)),
    twitter: fractal_core_1.props({ hint: 'Twitter' })(fractal_core_1.clone(FormTextInput)),
    linkedin: fractal_core_1.props({ hint: 'LinkedIn' })(fractal_core_1.clone(FormTextInput)),
    github: fractal_core_1.props({ hint: 'Github' })(fractal_core_1.clone(FormTextInput)),
    places: fractal_core_1.props({ hint: 'Sede' })(fractal_core_1.clone(FormTextInput)),
    tags: fractal_core_1.props({ hint: 'Categoría (5 máximo, separadas por comas)*' })(fractal_core_1.clone(FormTextInput)),
};
exports.state = {
    mode: 'modify',
    originalName: '',
    company: exports.emptyCompany,
    companies: [],
    companySizes: [
        ['micro', '1-10'],
        ['small', '11-50'],
        ['median', '51-200'],
        ['big', '201-...'],
    ],
    error: false,
    nameSearchTimer: -1,
    _nest: exports.components,
};
const nameSearchFn = (value, ms, cb) => setTimeout(() => {
    utils_1.search(value, 'name', '', 10)
        .then(([companies]) => cb(companies));
}, ms);
exports.inputs = F => ({
    init: async () => {
        let s = F.stateOf();
        if (s.mode === 'review') {
            await F.toChild('name', '_action', ['SetAttrs', { disabled: true }]);
        }
    },
    setActive: async () => { },
    setCompany: async ([company, setName]) => {
        await F.toAct('SetCompanyField', ['id', company._id]);
        if (setName) {
            await F.toChild('name', 'change', company.name);
            await F.toAct('SetOriginalName', company.name);
        }
        await F.toChild('email', 'change', company.email || '');
        await F.toChild('description', 'change', company.description || '');
        await F.toChild('webpage', 'change', company.webpage || '');
        await F.toChild('facebook', 'change', company.networks.facebook || '');
        await F.toChild('twitter', 'change', company.networks.twitter || '');
        await F.toChild('linkedin', 'change', company.networks.linkedin || '');
        await F.toChild('github', 'change', company.networks.github || '');
        await F.toChild('places', 'change', company.places.join(', ') || '');
        await F.toChild('tags', 'change', company.tags.join(', ') || '');
        await F.toAct('SetCompanyField', ['isStartup', company.isStartup || false]);
        await F.toAct('SetCompanyField', ['type', company.type || 'micro']);
    },
    reset: async () => {
        await F.toAct('SetCompanyField', ['id', '']);
        await F.toChild('name', 'change', '');
        await F.toChild('email', 'change', '');
        await F.toChild('description', 'change', '');
        await F.toChild('webpage', 'change', '');
        await F.toChild('facebook', 'change', '');
        await F.toChild('twitter', 'change', '');
        await F.toChild('linkedin', 'change', '');
        await F.toChild('github', 'change', '');
        await F.toChild('places', 'change', '');
        await F.toChild('tags', 'change', '');
        await F.toAct('SetCompany', exports.emptyCompany);
        await F.toAct('SetError', false);
    },
    getData: async () => {
        let s = F.stateOf();
        let company = {};
        company.id = s.company.id;
        company.name = F.stateOf('name').value;
        company.email = F.stateOf('email').value;
        company.description = F.stateOf('description').value;
        company.webpage = F.stateOf('webpage').value;
        company.networks = {};
        company.networks.facebook = F.stateOf('facebook').value;
        company.networks.twitter = F.stateOf('twitter').value;
        company.networks.linkedin = F.stateOf('linkedin').value;
        company.networks.github = F.stateOf('github').value;
        company.tags = F.stateOf('tags').value.split(',').map(t => t.trim());
        company.places = F.stateOf('places').value.split(',').map(p => p.trim());
        company.isStartup = s.company.isStartup;
        company.type = s.company.type;
        if (company.name &&
            company.email &&
            company.description &&
            company.tags.join(', ') &&
            !s.error) {
            await F.toAct('SetError', false);
            await F.toIt('data', company);
        }
        else {
            await F.toAct('SetError', true);
            await F.toIt('validationError');
        }
    },
    $name_change: async (value) => {
        let s = F.stateOf();
        if (s.mode === 'review') {
            return;
        }
        if (s.nameSearchTimer !== -1) {
            clearTimeout(s.nameSearchTimer);
        }
        // <any> por un error con el compilador AOT, algo relacionado con Timer
        s.nameSearchTimer = nameSearchFn(value, 400, async (companies) => {
            await F.toAct('SetCompanies', companies);
            let companiesEq = companies.filter(c => utils_1.strToLink(c.name) === utils_1.strToLink(value));
            if (companiesEq[0]) {
                if (s.mode === 'request') {
                    await F.toIt('setCompany', [companies[0], false]);
                    await F.toAct('SetError', false);
                }
                else if (s.mode === 'modify' && utils_1.strToLink(s.originalName) !== utils_1.strToLink(value)) {
                    await F.toChild('name', 'setError', true);
                    await F.toAct('SetError', true);
                }
            }
            else {
                if (s.error) {
                    await F.toAct('SetError', false);
                }
            }
        });
    },
    $email_change: async () => await F.toAct('SetError', false),
    $description_change: async () => await F.toAct('SetError', false),
    $tags_change: async () => await F.toAct('SetError', false),
    data: async () => { },
    validationError: async () => { },
});
exports.actions = {
    SetMode: fractal_core_1.assoc('mode'),
    SetCompany: fractal_core_1.assoc('company'),
    SetError: fractal_core_1.assoc('error'),
    SetCompanies: fractal_core_1.assoc('companies'),
    SetOriginalName: fractal_core_1.assoc('originalName'),
    SetIsStartup: selectedIndex => s => {
        s.company.isStartup = selectedIndex === 1;
        return s;
    },
    SetCompanyType: selectedIndex => s => {
        s.company.type = s.companySizes[selectedIndex][0];
        return s;
    },
    SetCompanyField: ([name, value]) => s => {
        s.company[name] = value;
        return s;
    },
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return view_1.h('div', {
        key: F.ctx.name,
        class: { [style.base]: true },
    }, [
        await F.vw('name'),
        ...s.mode === 'request' ? [view_1.h('datalist', { attrs: { id: 'companiesData' } }, s.companies.filter(c => !c.userId).map(c => view_1.h('option', c.name)))] : [],
        await F.vw('email'),
        await F.vw('description'),
        await F.vw('webpage'),
        await F.vw('facebook'),
        await F.vw('twitter'),
        await F.vw('linkedin'),
        await F.vw('github'),
        await F.vw('places'),
        await F.vw('tags'),
        view_1.h('div', { class: { [style.description]: true } }, '¿Tu empresa está en búsqueda de un modelo de negocio repetible y escalable (Startup)?*'),
        view_1.h('select', {
            class: { [style.select]: true },
            on: { change: F.act('SetIsStartup', fractal_core_1._, ['target', 'selectedIndex']) },
        }, [
            view_1.h('option', { props: { selected: !s.company.isStartup } }, 'No'),
            view_1.h('option', { props: { selected: s.company.isStartup } }, 'Si'),
        ]),
        view_1.h('div', { class: { [style.description]: true } }, '¿Cuantas personas hay en tu empresa?*'),
        view_1.h('select', {
            class: { [style.select]: true },
            on: { change: F.act('SetCompanyType', fractal_core_1._, ['target', 'selectedIndex']) },
        }, s.companySizes.map(sz => view_1.h('option', {
            props: { selected: s.company.type === sz[0] || s.company.type === undefined },
        }, sz[1]))),
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        maxWidth: '500px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    input: constants_1.simpleInput,
    finalInput: {
        marginBottom: '15px',
    },
    description: {
        maxWidth: '500px',
        padding: '17px 10px 17px 10px',
        textAlign: 'center',
        fontSize: '18px',
    },
    select: {
        marginBottom: '10px',
        fontSize: '18px',
        border: 'none',
        outline: 'none',
        background: 'none',
        borderBottom: '1px solid ' + constants_1.palette.borderLight,
    },
};
exports.groups = { style };
//# sourceMappingURL=CompanyForm.js.map
});
___scope___.file("app/Root/common/TextInput.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const constants_1 = require("../constants");
exports.state = {
    width: 0,
    value: '',
    hint: '',
    focus: false,
    error: false,
    attrs: {},
};
exports.inputs = F => ({
    setFocus: async (v) => await F.toAct('SetFocus', v),
    change: async (v) => await F.toAct('Change', v),
    keyUp: async () => { },
    setError: async (v) => await F.toAct('SetError', v),
});
exports.actions = {
    SetWidth: fractal_core_1.assoc('width'),
    SetFocus: fractal_core_1.assoc('focus'),
    SetError: fractal_core_1.assoc('error'),
    SetAttrs: fractal_core_1.assoc('attrs'),
    Change: value => s => {
        s.value = value;
        s.error = false;
        return s;
    },
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return view_1.h('div', {
        key: F.ctx.name,
        class: {
            [style.base]: true,
        },
        size: F.act('SetWidth', fractal_core_1._, 'width'),
    }, [
        view_1.h('input', {
            key: F.ctx.name,
            class: { [style.input]: true },
            props: { value: s.value },
            on: {
                keyup: F.in('keyUp', fractal_core_1._, 'keyCode', { default: true }),
                input: F.in('change', fractal_core_1._, ['target', 'value']),
                focus: F.in('setFocus', true),
                blur: F.in('setFocus', false),
            },
            attrs: Object.assign({ type: 'text' }, s.attrs),
        }),
        view_1.h('div', { class: {
                [style.lineContainer]: true,
                [style.lineContainerFocus]: s.focus,
            } }, [
            view_1.h('div', {
                class: {
                    [style.bottomLine]: true,
                    [style.bottomLineFocus]: s.focus,
                    [style.bottomLineError]: s.error,
                },
                style: s.focus ? { transform: `scaleX(${s.width})` } : {},
            })
        ]),
        view_1.h('label', {
            class: {
                [style.hint]: true,
                [style.hintActive]: s.focus || s.value !== '',
                [style.hintError]: s.error,
            },
        }, s.hint),
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        width: '100%',
        position: 'relative',
        margin: '10px',
    },
    input: Object.assign({ position: 'relative', width: '100%', zIndex: 2, padding: '15px 0px 4px 0px', fontSize: '18px', outline: 'none', border: 'none', backgroundColor: 'rgba(0, 0, 0, 0)' }, constants_1.textStyle),
    hint: Object.assign({ position: 'absolute', left: '9px', top: '15px', padding: '0 4px 4px 0', fontSize: '18px', textRendering: 'geometricPrecision', transition: 'transform .2s', transformOrigin: 'left top' }, constants_1.textStyle, { color: constants_1.palette.textTertiary }),
    hintActive: {
        transform: 'translate(-9px, -15px) scale(0.67)',
        padding: '0',
        color: constants_1.palette.primary,
    },
    hintError: {
        color: constants_1.palette.redCol,
    },
    lineContainer: {
        width: '100%',
        height: '2px',
        borderTop: '1px solid ' + constants_1.palette.borderLight,
        display: 'flex',
        justifyContent: 'center',
    },
    lineContainerFocus: {
        borderTop: 'none',
    },
    bottomLine: {
        visibility: 'hidden',
        width: '1px',
        height: '2px',
        transition: 'transform .3s',
        backgroundColor: constants_1.palette.primary,
    },
    bottomLineFocus: {
        visibility: 'visible',
    },
    bottomLineError: {
        backgroundColor: constants_1.palette.redCol,
    },
};
exports.groups = { style };
//# sourceMappingURL=TextInput.js.map
});
___scope___.file("app/Root/common/TextArea.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const constants_1 = require("../constants");
exports.state = {
    width: 0,
    value: '',
    hint: '',
    attrs: {},
    focus: false,
};
exports.inputs = F => ({
    setFocus: async (v) => await F.toAct('SetFocus', v),
    change: async (v) => await F.toAct('Change', v),
    keyUp: async () => { },
});
exports.actions = {
    SetWidth: fractal_core_1.assoc('width'),
    SetFocus: fractal_core_1.assoc('focus'),
    Change: fractal_core_1.assoc('value'),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return view_1.h('div', {
        key: F.ctx.name,
        class: {
            [style.base]: true,
        },
        size: F.act('SetWidth', fractal_core_1._, 'width'),
    }, [
        view_1.h('textarea', {
            key: F.ctx.name,
            class: { [style.input]: true },
            props: { value: s.value },
            on: {
                keyup: F.in('keyUp', fractal_core_1._, 'keyCode', { default: true }),
                input: F.in('change', fractal_core_1._, ['target', 'value']),
                focus: F.in('setFocus', true),
                blur: F.in('setFocus', false),
            },
            attrs: s.attrs,
        }),
        view_1.h('div', { class: {
                [style.lineContainer]: true,
                [style.lineContainerFocus]: s.focus,
            } }, [
            view_1.h('div', {
                class: {
                    [style.bottomLine]: true,
                    [style.bottomLineFocus]: s.focus,
                },
                style: s.focus ? { transform: `scaleX(${s.width})` } : {},
            })
        ]),
        view_1.h('label', {
            class: {
                [style.hint]: true,
                [style.hintActive]: s.focus || s.value !== '',
            },
        }, s.hint),
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        width: '100%',
        position: 'relative',
        margin: '10px',
    },
    input: Object.assign({ position: 'relative', width: '100%', zIndex: 2, padding: '15px 0px 4px 0px', fontSize: '18px', outline: 'none', border: 'none', backgroundColor: 'rgba(0, 0, 0, 0)' }, constants_1.textStyle),
    hint: Object.assign({ position: 'absolute', left: '9px', top: '15px', padding: '0 4px 4px 0', fontSize: '18px', textRendering: 'geometricPrecision', transition: 'transform .2s', transformOrigin: 'left top' }, constants_1.textStyle, { color: constants_1.palette.textTertiary }),
    hintActive: {
        transform: 'translate(-9px, -15px) scale(0.67)',
        padding: '0',
        color: constants_1.palette.primary,
    },
    lineContainer: {
        width: '100%',
        height: '2px',
        borderTop: '1px solid ' + constants_1.palette.borderLight,
        display: 'flex',
        justifyContent: 'center',
    },
    lineContainerFocus: {
        borderTop: 'none',
    },
    bottomLine: {
        visibility: 'hidden',
        width: '1px',
        height: '2px',
        transition: 'transform .3s',
        backgroundColor: constants_1.palette.primary,
    },
    bottomLineFocus: {
        visibility: 'visible',
    },
};
exports.groups = { style };
//# sourceMappingURL=TextArea.js.map
});
___scope___.file("app/Root/Dashboard/ModifyCompany.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const config_1 = require("../../config");
const constants_1 = require("../constants");
const CompanyForm = require("../common/CompanyForm");
exports.components = {
    CompanyForm: fractal_core_1.pipe(fractal_core_1.props({ mode: 'modify' }))(fractal_core_1.clone(CompanyForm)),
};
exports.state = {
    token: '',
    datos: {
        code: 0,
        state: '',
    },
    profile: {
        name: '',
        email: '',
    },
    pendingRemoval: false,
    _nest: exports.components,
};
exports.inputs = F => ({
    setActive: async ([token, profile]) => {
        await F.toAct('SetToken', token);
        await F.toAct('SetProfile', profile);
        await F.toChild('CompanyForm', 'setActive');
    },
    setCompany: async (company) => {
        await F.toChild('CompanyForm', 'setCompany', [company, true]);
    },
    remove: async () => {
        await F.toAct('Set', ['pendingRemoval', true]);
        await F.toChild('CompanyForm', 'getData');
    },
    saveCompany: async () => {
        await F.toAct('Set', ['pendingRemoval', false]);
        await F.toChild('CompanyForm', 'getData');
    },
    $CompanyForm_data: async (company) => {
        let s = F.stateOf();
        company._id = company.id;
        delete company.id;
        if (s.pendingRemoval) {
            if (confirm('¿Estas seguro de que deseas eliminar ' + company.name + '?')) { }
            company._deleted = true;
        }
        fetch(config_1.getServer() + '/api/company', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + s.token,
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(company),
        })
            .then(r => r.json())
            .then(res => {
            if (res.code === 0) {
                F.toChild('CompanyForm', 'reset');
                F.toIt('close');
                if (s.pendingRemoval) {
                    alert('La empresa fue guardada exitosamente');
                }
                else {
                    alert('La empresa fue eliminada exitosamente');
                }
            }
            else {
                alert('Hay un problema, estoy trabajando en darle pronta solución');
            }
        })
            .catch(() => alert('No hay conexión o hay un error, puedes escribirme si el problema persiste'));
    },
    $CompanyForm_validationError: async () => {
        alert('Debes completar el formulario');
    },
    close: async () => {
        await F.toChild('CompanyForm', 'reset');
    },
});
exports.actions = {
    SetToken: fractal_core_1.assoc('token'),
    SetProfile: fractal_core_1.assoc('profile'),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return view_1.h('div', {
        class: { [style.base]: true },
        on: { click: 'ignore' },
    }, [
        view_1.h('div', {
            class: { [style.closeBtn]: true },
            on: { click: F.in('close') },
        }, 'x'),
        view_1.h('div', { class: { [style.container]: true } }, [
            await F.vw('CompanyForm'),
            view_1.h('div', { class: { [style.buttonContainer]: true } }, [
                view_1.h('button', {
                    class: { [style.cancelBtn]: true },
                    on: { click: F.in('remove') },
                }, 'Eliminar'),
                view_1.h('button', {
                    class: { [style.saveCompanyBtn]: true },
                    on: { click: F.in('saveCompany') },
                }, 'Guardar'),
            ]),
        ]),
    ]);
};
exports.interfaces = { view };
const style = {
    base: {
        position: 'relative',
        height: '90%',
        borderRadius: '7px',
        backgroundColor: 'white',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                height: '100%',
                borderRadius: '0',
            },
        },
    },
    container: Object.assign({ width: '100%', height: '100%', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'scroll' }, constants_1.scrollBar),
    emailForm: {
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 0 10px 0',
    },
    emailText: {
        maxWidth: '500px',
        padding: '0 20px 5px 20px',
        textAlign: 'center',
        fontSize: '18px',
    },
    initialInput: {
        marginTop: '10px',
    },
    finalInput: {
        marginBottom: '15px',
    },
    companyForm: {
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    buttonContainer: {
        flexShrink: 0,
        display: 'flex',
        margin: '24px 15px 15px 15px',
    },
    cancelBtn: fractal_core_1.deepmerge(constants_1.buttonCancelStyle, {
        marginRight: '35px',
    }),
    saveCompanyBtn: constants_1.buttonPrimaryStyle,
    closeBtn: Object.assign({ position: 'absolute', right: '-12px', top: '-12px', width: '24px', height: '24px', fontSize: '16px', borderRadius: '50%', background: 'white', boxShadow: '0 0 1px 1px ' + constants_1.palette.borderLight }, fractal_core_1.clickable, fractal_core_1.absoluteCenter),
};
exports.groups = { style };
//# sourceMappingURL=ModifyCompany.js.map
});
___scope___.file("app/Root/Admin/index.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const config_1 = require("../../config");
const constants_1 = require("../constants");
const CompanyForm = require("../common/CompanyForm");
exports.components = {
    CompanyForm: fractal_core_1.props({ mode: 'review' })(fractal_core_1.clone(CompanyForm)),
};
exports.state = {
    active: false,
    token: '',
    profile: {
        id: '',
    },
    companyUnreviewedId: '',
    companyId: '',
    userId: '',
    userFb: '',
    _nest: exports.components,
};
exports.inputs = F => ({
    setTokenAndProfile: async ([token, profile]) => {
        let s = F.stateOf();
        await F.toAct('SetTokenAndProfile', [token, profile]);
        if (s.active) {
            await F.toIt('getUnreviewed');
        }
    },
    setActive: async () => {
        let s = F.stateOf();
        await F.toAct('SetActive', true);
        if (s.token) {
            await F.toIt('getUnreviewed');
        }
    },
    getUnreviewed: async () => {
        let s = F.stateOf();
        await F.toChild('CompanyForm', 'reset');
        try {
            let company = await fetch(config_1.getServer() + '/api/unreviewed/0', {
                headers: {
                    Authorization: 'Bearer ' + s.token,
                },
            }).then(r => r.json());
            if (company.code === -2) {
                alert('No hay mas compañias por revisar ...');
            }
            else if (company.code < 0) {
                alert('Hay un problema, estoy trabajando en darle pronta solución');
            }
            else {
                await F.toAct('SetCompanyUnreviewedId', company._id);
                await F.toAct('SetCompanyId', company.id);
                await F.toChild('CompanyForm', 'setCompany', [company, true]);
                await F.toIt('setCompanyData', company);
            }
        }
        catch (err) {
            alert('No hay conexión o hay un error, puedes escribirme si el problema persiste');
        }
    },
    deny: async () => {
        let s = F.stateOf();
        try {
            let res = await fetch(config_1.getServer() + '/api/deny', {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + s.token,
                    Accept: 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: s.companyUnreviewedId }),
            }).then(r => r.json());
            if (res.code === 0) {
                await F.toChild('CompanyForm', 'reset');
                await F.toAct('SetCompanyUnreviewedId', '');
                await F.toAct('SetCompanyId', '');
                await F.toIt('getUnreviewed');
            }
            else {
                alert('Hay un problema, estoy trabajando en darle pronta solución');
            }
        }
        catch (err) {
            alert('No hay conexión o hay un error, puedes escribirme si el problema persiste');
        }
    },
    addCompany: async () => {
        await F.toChild('CompanyForm', 'getData');
    },
    setCompanyData: async (company) => {
        await F.toAct('SetUserId', company.userId);
        await F.toAct('SetUserFb', company.userFb);
    },
    $CompanyForm_data: async (company) => {
        let s = F.stateOf();
        company._id = s.companyUnreviewedId;
        company.id = s.companyId;
        fetch(config_1.getServer() + '/api/accept', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + s.token,
                Accept: 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(company),
        })
            .then(r => r.json())
            .then(res => {
            if (res.code === 0) {
                F.toChild('CompanyForm', 'reset');
                F.toAct('SetCompanyUnreviewedId', '');
                F.toIt('getUnreviewed');
            }
            else {
                alert('Hay un problema, estoy trabajando en darle pronta solución');
            }
        })
            .catch(() => alert('No hay conexión o hay un error, puedes escribirme si el problema persiste'));
    },
    $CompanyForm_validationError: async () => {
        alert('Por favor, completa el formulario');
    },
});
exports.actions = {
    SetTokenAndProfile: ([token, profile]) => s => {
        s.token = token;
        return s;
    },
    SetCompanyUnreviewedId: fractal_core_1.assoc('companyUnreviewedId'),
    SetActive: fractal_core_1.assoc('active'),
    SetUserId: fractal_core_1.assoc('userId'),
    SetUserFb: fractal_core_1.assoc('userFb'),
    SetCompanyId: fractal_core_1.assoc('companyId'),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return !s.token
        ? view_1.h('div', { class: { [style.base]: true } }, 'Sitio para administradores')
        : view_1.h('div', {
            key: F.ctx.name,
            class: { [style.base]: true },
        }, [
            await F.vw('CompanyForm'),
            view_1.h('a', {
                class: { [style.link]: true },
                attrs: { href: 'https://facebook.com/' + s.userId, target: '_blank', rel: 'noopener noreferrer' },
            }, 'Facebook de usuario que hace PETICION'),
            ...s.userFb ? [
                view_1.h('a', {
                    class: { [style.link]: true },
                    attrs: { href: s.userFb, target: '_blank', rel: 'noopener noreferrer' },
                }, 'Facebook de usuario de EMPRESA'),
            ] : [
                view_1.h('div', 'Nueva empresa'),
            ],
            ...s.companyUnreviewedId ? [
                view_1.h('div', { class: { [style.buttonContainer]: true } }, [
                    view_1.h('button', {
                        class: { [style.denyBtn]: true },
                        on: { click: F.in('deny') },
                    }, 'Denegar'),
                    view_1.h('button', {
                        class: { [style.addCompanyBtn]: true },
                        on: { click: F.in('addCompany') },
                    }, 'Aceptar'),
                ])
            ] : [
                view_1.h('button', {
                    class: { [style.addCompanyBtn]: true },
                    on: { click: F.in('getUnreviewed') },
                }, 'Cargar')
            ],
        ]);
};
exports.interfaces = { view };
const style = {
    base: {
        flexShrink: 0,
        width: '100%',
        paddingBottom: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    link: {
        padding: '10px',
    },
    buttonContainer: {
        flexShrink: 0,
        display: 'flex',
        margin: '24px 15px 35px 15px',
    },
    denyBtn: fractal_core_1.deepmerge(constants_1.buttonCancelStyle, {
        marginTop: '35px',
        marginRight: '35px',
    }),
    addCompanyBtn: fractal_core_1.deepmerge(constants_1.buttonPrimaryStyle, {
        marginTop: '35px',
    }),
};
exports.groups = { style };
//# sourceMappingURL=index.js.map
});
___scope___.file("app/Root/Site.js", function(exports, require, module, __filename, __dirname){

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fractal_core_1 = require("fractal-core");
const view_1 = require("fractal-core/interfaces/view");
const constants_1 = require("./constants");
exports.state = {
    fetched: false,
    name: '',
    description: '',
    webpage: '',
    user: '',
    userId: '',
    userFb: '',
    networks: {
        facebook: '',
    },
    places: [],
    tags: [],
};
exports.inputs = F => ({
    setActive: async (state) => {
        await F.toAct('SetState', state);
    },
    toSite: async (route) => {
        await F.runIt(['route', [route]]);
    },
});
exports.actions = {
    SetState: state => s => fractal_core_1.deepmerge(s, state),
};
const view = F => async (s) => {
    let style = F.ctx.groups.style;
    return !s.fetched ? view_1.h('div', {
        key: F.ctx.name,
        class: { [style.base]: true },
    }, [
        view_1.h('h1', { class: { [style.titleError]: true } }, `No existe una empresa llamada "${s.name}" en la plataforma`),
        view_1.h('div', { class: { [style.description]: true } }, [
            'Inscríbela fácilmente dese ',
            view_1.h('a', {
                class: { [style.linkNormal]: true },
                attrs: { href: '/' },
                on: { click: F.in('toSite', '/', fractal_core_1._, { default: false }) },
            }, 'startupcol.com'),
        ]),
    ])
        : view_1.h('div', {
            key: F.ctx.name,
            class: { [style.base]: true },
        }, [
            view_1.h('a', {
                class: { [style.toMainPage]: true, [style.linkNormal]: true },
                attrs: { href: '/' },
                on: { click: F.in('toSite', '/', fractal_core_1._, { default: false }) },
            }, 'startupcol.com'),
            view_1.h('h1', { class: { [style.title]: true } }, s.name),
            ...s.description ? [view_1.h('p', { class: { [style.description]: true } }, s.description)] : [],
            ...s.webpage ? [view_1.h('a', {
                    class: { [style.link]: true, [style.coloredLink]: true },
                    attrs: { href: s.webpage, target: '_blank', rel: 'noopener noreferrer' },
                }, 'Sitio')] : [],
            ...s.networks.facebook ? [view_1.h('a', {
                    class: { [style.link]: true, [style.coloredLink]: true },
                    attrs: { href: s.networks.facebook, target: '_blank', rel: 'nofollow noopener noreferrer' },
                }, 'Facebook')] : [],
            view_1.h('a', {
                class: { [style.link]: true },
                attrs: { href: s.userFb ? s.userFb : 'facebook.com/' + s.userId, target: '_blank', rel: 'nofollow noopener noreferrer' },
            }, s.user),
            view_1.h('div', {
                class: { [style.places]: true },
            }, s.places[0]),
            s.tags ? view_1.h('div', { class: { [style.tags]: true } }, s.tags.map(tagName => view_1.h('div', {
                class: { [style.tag]: true },
            }, tagName))) : view_1.h('div'),
        ]);
};
exports.interfaces = { view };
const style = {
    base: Object.assign({ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto' }, constants_1.textStyle),
    linkNormal: Object.assign({ padding: '5px', fontSize: '14px', color: constants_1.palette.textTertiary, textDecoration: 'none' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                textDecoration: 'underline',
            },
        } }),
    toMainPage: {
        position: 'absolute',
        top: '0px',
        right: '0px',
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                top: 'auto',
                bottom: '0px',
            },
        },
    },
    title: {
        minWidth: '400px',
        margin: '0 0 7px 0',
        padding: '20px 20px 20px 20px',
        fontSize: '45px',
        textAlign: 'center',
        color: constants_1.palette.primary,
        borderBottom: '1px solid ' + constants_1.palette.borderLight,
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                minWidth: '100%',
            },
        },
    },
    titleError: {
        minWidth: '400px',
        margin: '0 0 20px 0',
        padding: '20px 20px 20px 20px',
        fontSize: '22px',
        textAlign: 'center',
        color: constants_1.palette.primary,
        borderBottom: '1px solid ' + constants_1.palette.borderLight,
    },
    description: {
        margin: '0',
        maxWidth: '700px',
        padding: '12px 15px 24px 15px',
        textAlign: 'center',
        fontSize: '24px',
        color: constants_1.palette.textPrimary,
        $nest: {
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                fontSize: '22px',
            },
        },
    },
    link: Object.assign({ color: constants_1.palette.textTertiary, padding: '5px 8px', textDecoration: 'none', fontSize: '20px', borderRadius: '4px' }, fractal_core_1.clickable, { $nest: {
            '&:hover': {
                backgroundColor: constants_1.palette.shadowLight,
            },
            [`@media screen and (max-width: ${constants_1.BP.sm}px)`]: {
                width: '90%',
                padding: '8px 8px',
                textAlign: 'center',
            },
        } }),
    coloredLink: {
        color: constants_1.palette.primary,
    },
    places: {
        marginTop: '8px',
        marginBottom: '2px',
        padding: '3px',
        borderRadius: '4px',
        fontSize: '16px',
        color: constants_1.palette.textTertiary,
    },
    tags: {
        maxWidth: '85%',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    tag: {
        margin: '3px',
        padding: '3px',
        borderRadius: '4px',
        fontSize: '14px',
        color: constants_1.palette.textTertiary,
        border: '1px solid ' + constants_1.palette.borderGrey,
    },
};
exports.groups = { style };
//# sourceMappingURL=Site.js.map
});
return ___scope___.entry = "server/index.ts";
});
FuseBox.target = "server"

FuseBox.import("default/server/index.js");
FuseBox.main("default/server/index.js");
})
(function(e){function r(e){var r=e.charCodeAt(0),n=e.charCodeAt(1);if((p||58!==n)&&(r>=97&&r<=122||64===r)){if(64===r){var t=e.split("/"),i=t.splice(2,t.length).join("/");return[t[0]+"/"+t[1],i||void 0]}var o=e.indexOf("/");if(o===-1)return[e];var a=e.substring(0,o),u=e.substring(o+1);return[a,u]}}function n(e){return e.substring(0,e.lastIndexOf("/"))||"./"}function t(){for(var e=[],r=0;r<arguments.length;r++)e[r]=arguments[r];for(var n=[],t=0,i=arguments.length;t<i;t++)n=n.concat(arguments[t].split("/"));for(var o=[],t=0,i=n.length;t<i;t++){var a=n[t];a&&"."!==a&&(".."===a?o.pop():o.push(a))}return""===n[0]&&o.unshift(""),o.join("/")||(o.length?"/":".")}function i(e){var r=e.match(/\.(\w{1,})$/);return r&&r[1]?e:e+".js"}function o(e){if(p){var r,n=document,t=n.getElementsByTagName("head")[0];/\.css$/.test(e)?(r=n.createElement("link"),r.rel="stylesheet",r.type="text/css",r.href=e):(r=n.createElement("script"),r.type="text/javascript",r.src=e,r.async=!0),t.insertBefore(r,t.firstChild)}}function a(e,r){for(var n in e)e.hasOwnProperty(n)&&r(n,e[n])}function u(e){return{server:require(e)}}function f(e,n){var o=n.path||"./",a=n.pkg||"default",f=r(e);if(f&&(o="./",a=f[0],n.v&&n.v[a]&&(a=a+"@"+n.v[a]),e=f[1]),e)if(126===e.charCodeAt(0))e=e.slice(2,e.length),o="./";else if(!p&&(47===e.charCodeAt(0)||58===e.charCodeAt(1)))return u(e);var s=g[a];if(!s){if(p&&"electron"!==x.target)throw"Package not found "+a;return u(a+(e?"/"+e:""))}e=e?e:"./"+s.s.entry;var l,c=t(o,e),d=i(c),v=s.f[d];return!v&&d.indexOf("*")>-1&&(l=d),v||l||(d=t(c,"/","index.js"),v=s.f[d],v||"."!==c||(d=s.s&&s.s.entry||"index.js",v=s.f[d]),v||(d=c+".js",v=s.f[d]),v||(v=s.f[c+".jsx"]),v||(d=c+"/index.jsx",v=s.f[d])),{file:v,wildcard:l,pkgName:a,versions:s.v,filePath:c,validPath:d}}function s(e,r,n){if(void 0===n&&(n={}),!p)return r(/\.(js|json)$/.test(e)?v.require(e):"");if(n&&n.ajaxed===e)return console.error(e,"does not provide a module");var i=new XMLHttpRequest;i.onreadystatechange=function(){if(4==i.readyState)if(200==i.status){var n=i.getResponseHeader("Content-Type"),o=i.responseText;/json/.test(n)?o="module.exports = "+o:/javascript/.test(n)||(o="module.exports = "+JSON.stringify(o));var a=t("./",e);x.dynamic(a,o),r(x.import(e,{ajaxed:e}))}else console.error(e,"not found on request"),r(void 0)},i.open("GET",e,!0),i.send()}function l(e,r){var n=h[e];if(n)for(var t in n){var i=n[t].apply(null,r);if(i===!1)return!1}}function c(e,r){if(void 0===r&&(r={}),58===e.charCodeAt(4)||58===e.charCodeAt(5))return o(e);var t=f(e,r);if(t.server)return t.server;var i=t.file;if(t.wildcard){var a=new RegExp(t.wildcard.replace(/\*/g,"@").replace(/[.?*+^$[\]\\(){}|-]/g,"\\$&").replace(/@@/g,".*").replace(/@/g,"[a-z0-9$_-]+"),"i"),u=g[t.pkgName];if(u){var d={};for(var m in u.f)a.test(m)&&(d[m]=c(t.pkgName+"/"+m));return d}}if(!i){var h="function"==typeof r,x=l("async",[e,r]);if(x===!1)return;return s(e,function(e){return h?r(e):null},r)}var _=t.pkgName;if(i.locals&&i.locals.module)return i.locals.module.exports;var y=i.locals={},w=n(t.validPath);y.exports={},y.module={exports:y.exports},y.require=function(e,r){return c(e,{pkg:_,path:w,v:t.versions})},p||!v.require.main?y.require.main={filename:"./",paths:[]}:y.require.main=v.require.main;var j=[y.module.exports,y.require,y.module,t.validPath,w,_];return l("before-import",j),i.fn.apply(0,j),l("after-import",j),y.module.exports}if(e.FuseBox)return e.FuseBox;var d="undefined"!=typeof WorkerGlobalScope,p="undefined"!=typeof window&&window.navigator||d,v=p?d?{}:window:global;p&&(v.global=d?{}:window),e=p&&"undefined"==typeof __fbx__dnm__?e:module.exports;var m=p?d?{}:window.__fsbx__=window.__fsbx__||{}:v.$fsbx=v.$fsbx||{};p||(v.require=require);var g=m.p=m.p||{},h=m.e=m.e||{},x=function(){function r(){}return r.global=function(e,r){return void 0===r?v[e]:void(v[e]=r)},r.import=function(e,r){return c(e,r)},r.on=function(e,r){h[e]=h[e]||[],h[e].push(r)},r.exists=function(e){try{var r=f(e,{});return void 0!==r.file}catch(e){return!1}},r.remove=function(e){var r=f(e,{}),n=g[r.pkgName];n&&n.f[r.validPath]&&delete n.f[r.validPath]},r.main=function(e){return this.mainFile=e,r.import(e,{})},r.expose=function(r){var n=function(n){var t=r[n].alias,i=c(r[n].pkg);"*"===t?a(i,function(r,n){return e[r]=n}):"object"==typeof t?a(t,function(r,n){return e[n]=i[r]}):e[t]=i};for(var t in r)n(t)},r.dynamic=function(r,n,t){this.pkg(t&&t.pkg||"default",{},function(t){t.file(r,function(r,t,i,o,a){var u=new Function("__fbx__dnm__","exports","require","module","__filename","__dirname","__root__",n);u(!0,r,t,i,o,a,e)})})},r.flush=function(e){var r=g.default;for(var n in r.f)e&&!e(n)||delete r.f[n].locals},r.pkg=function(e,r,n){if(g[e])return n(g[e].s);var t=g[e]={};return t.f={},t.v=r,t.s={file:function(e,r){return t.f[e]={fn:r}}},n(t.s)},r.addPlugin=function(e){this.plugins.push(e)},r.packages=g,r.isBrowser=p,r.isServer=!p,r.plugins=[],r}();return p||(v.FuseBox=x),e.FuseBox=x}(this))
//# sourceMappingURL=index.js.map