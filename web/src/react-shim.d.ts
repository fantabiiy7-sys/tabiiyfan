// Muhit cheklovi: @types/react o'rnatilmagan (npm registry yopiq). Oddiy muhitda `npm i -D @types/react @types/react-dom` qilib bu faylni o'chiring.
declare module 'react' {
  export function useState<T = any>(init?: T | (() => T)): [T, (v: T | ((p: T) => T)) => void];
  export function useRef<T = any>(init?: T | null): { current: T };
  export function useMemo<T>(f: () => T, deps?: any[]): T;
  export function useCallback<T extends (...a: any[]) => any>(f: T, deps?: any[]): T;
  export function useEffect(f: () => void | (() => void), deps?: any[]): void;
  export function useLayoutEffect(f: () => void | (() => void), deps?: any[]): void;
  export function createContext<T>(v: T): any;
  export function useContext<T = any>(c: any): T;
  export const useId: any, useReducer: any, Fragment: any, Suspense: any, lazy: any, memo: any, StrictMode: any, useSyncExternalStore: any, useDeferredValue: any;
  export type ReactNode = any; export type ChangeEvent<T = any> = any; export type FormEvent<T = any> = any; export type KeyboardEvent<T = any> = any;
  export type MouseEvent<T = any> = any; export type DragEvent<T = any> = any; export type CSSProperties = any; export type Dispatch<T> = any; export type SetStateAction<T> = any;
  export type RefObject<T> = any; export type ReactElement = any;
}
declare module 'react-dom/client' { export const createRoot: any; }
declare module 'react/jsx-runtime' { export const jsx: any, jsxs: any, Fragment: any; }
declare module '*.css' { const c: string; export default c; }
declare namespace React { type FormEvent<T = any> = any; type ChangeEvent<T = any> = any; type KeyboardEvent<T = any> = any; type MouseEvent<T = any> = any; }
declare namespace JSX { interface IntrinsicElements { [k: string]: any } interface IntrinsicAttributes { key?: any } type Element = any; interface ElementChildrenAttribute { children: {} } }
