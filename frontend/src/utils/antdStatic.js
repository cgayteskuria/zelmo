/**
 * antdStatic.js
 *
 * Fournit message / modal / notification AntD compatibles avec le contexte
 * dynamique (thème, locale) en capturant les instances via App.useApp().
 *
 * Usage :
 *   1. Monter <AntdStaticProvider /> une seule fois à l'intérieur de <App>
 *   2. Remplacer `import { message } from 'antd'` par
 *      `import { message } from '../utils/antdStatic'`
 */
import { App } from 'antd';

let _message      = null;
let _modal        = null;
let _notification = null;

export function AntdStaticProvider() {
    const app = App.useApp();
    _message      = app.message;
    _modal        = app.modal;
    _notification = app.notification;
    return null;
}

function makeProxy(getter) {
    return new Proxy(
        {},
        {
            get(_, prop) {
                const instance = getter();
                if (instance) return instance[prop];
                // Fallback silencieux si appelé avant le montage
                return () => {};
            },
        }
    );
}

export const message      = makeProxy(() => _message);
export const modal        = makeProxy(() => _modal);
export const notification = makeProxy(() => _notification);
