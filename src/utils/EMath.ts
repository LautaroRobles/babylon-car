import { float } from "@babylonjs/core"

/**
 * Clase para agregar funciones que Math no incluye
 */
export class EMath {
    static clamp(min: float, max: float, value: float): float {
        return Math.min(Math.max(value, min), max)
    }
    static clamp01(value: float): float {
        return this.clamp(0, 1, value)
    }
    static lerp(a: float, b: float, t: float): float{
        return a + (b - a) * this.clamp01(t)
    }
    static unclampedLerp(a: float, b: float, t: float): float{
        return a + (b - a) * t
    }
}
