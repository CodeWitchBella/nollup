let node_resolve = require('rollup-plugin-node-resolve');
let babel = require('rollup-plugin-babel');
let hotcss = require('rollup-plugin-hot-css');
let commonjs = require('rollup-plugin-commonjs-alternate');
let replace = require('rollup-plugin-replace');
let static_files = require('rollup-plugin-static-files');
let terser = require('rollup-plugin-terser').terser;
let path = require('path')

function fresh({ input, exts = ['.js', '.jsx', '.ts', '.tsx', '.mjs'] }) {
    let originalInput = ''
    let nonentry = new Set()
    return {
        name: 'react-fresh',
        resolveId(id) {
            if (id === 'fresh-entrypoint') return id
            if (id === 'fresh-utils') return id
            return null
        },
        async load(id) {
            if(id === 'fresh-utils') {
                return `
                    import * as imp from 'react-refresh/runtime'
                    export const runtime = 'injectIntoGlobalHook' in imp ? imp : imp.default;

                    export function isReactRefreshBoundary(moduleExports) {
                        if (runtime.isLikelyComponentType(moduleExports)) {
                            return true;
                        }
                        if (moduleExports == null || typeof moduleExports !== 'object') {
                            // Exit if we can't iterate over exports.
                            return false;
                        }
                        let hasExports = false;
                        let areAllExportsComponents = true;
                        for (const key in moduleExports) {
                            hasExports = true;
                            if (key === '__esModule') {
                                continue;
                            }
                            const desc = Object.getOwnPropertyDescriptor(moduleExports, key);
                            if (desc && desc.get) {
                                // Don't invoke getters as they may have side effects.
                                return false;
                            }
                            const exportValue = moduleExports[key];
                            if (!runtime.isLikelyComponentType(exportValue)) {
                                areAllExportsComponents = false;
                            }
                        }
                        return hasExports && areAllExportsComponents;
                    };

                    let refreshTimeout = -1;
                    export function refresh() {
                        if (refreshTimeout === -1) {
                            refreshTimeout = setTimeout(() => {
                                refreshTimeout = -1;
                                console.log('Performing refresh')
                                runtime.performReactRefresh();
                            }, 30);
                        }
                    }
                `
            }

            // https://github.com/PepsRyuu/nollup/issues/33
            if (!id.endsWith('fresh-entrypoint')) return null
            return `
            Promise.resolve().then(() => {
                if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
                    return import('fresh-utils').then(({ runtime }) => {
                        window.$RefreshRuntime$ = runtime;
                        runtime.injectIntoGlobalHook(window);
                        window.$RefreshReg$ = () => { console.log('Fallback $RefreshReg$')};
                        window.$RefreshSig$ = () => type => type;
                    })
                }
            }).then(() => import('${input}'))
            `
        },
        nollupModuleWrap(mod) {
            return `
                var prevRefreshReg = window.$RefreshReg$;
                var prevRefreshSig = window.$RefreshSig$;
                var RefreshRuntime = window.$RefreshRuntime$

                if (RefreshRuntime) {
                    window.$RefreshReg$ = (type, id) => {
                        // Note module.id is webpack-specific, this may vary in other bundlers
                        const fullId = module.id + ' ' + id;
                        RefreshRuntime.register(type, fullId);
                    }
                    window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
                }

                try {
                    ${mod}
                } finally {
                    window.$RefreshReg$ = prevRefreshReg;
                    window.$RefreshSig$ = prevRefreshSig;
                }
            `
        },
        transform ( code, id ) {
            if (id === 'fresh-utils'
                || id.endsWith('fresh-entrypoint')
                || id.includes('node_modules')
                || !exts.some(ext => id.endsWith(ext))
            ) return

            return {
                code: code + `
                    import * as __FreshUtils__ from 'fresh-utils'

                    if (
                        module.hot &&
                        __FreshUtils__.isReactRefreshBoundary(module.exports)
                    ) {
                        module.hot.accept(() => require(module.id))
                        __FreshUtils__.refresh();
                    }
                `,
                map: null,
            };
        },
    }
}

let config = {
    input: {
        //main: './src/main.js',
        main: 'fresh-entrypoint',
    },
    output: {
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
    },
    plugins: [
        fresh({ input: './src/main.js' }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        }),
        hotcss({
            hot: process.env.NODE_ENV === 'development',
            filename: 'styles.css'
        }),
        babel(),
        node_resolve(),
        commonjs({
            namedExports: {
                'node_modules/react/index.js': [
                    'Component'
                ]
            }
        })
    ]
}

if (process.env.NODE_ENV === 'production') {
    config.plugins = config.plugins.concat([
        static_files({
            include: ['./public']
        }),
        terser({
            compress: {
                global_defs: {
                    module: false
                }
            }
        })
    ]);
}

module.exports = config;