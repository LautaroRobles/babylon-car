import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { createScene } from "./scenes/scene2";
import { Engine } from "@babylonjs/core";

// Determina si en la escena se mostrara un menu de debug
const debug = !import.meta.env.PROD

// Inicializamos Babylon
console.log(`Iniciando Juego`);
window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
    const engine = new Engine(canvas)
    const scene = await createScene(engine, canvas) // Por ahora solamente tenemos una unica escena

    if (debug) {
        scene.debugLayer.show({ overlay: true });
    } else {
        scene.debugLayer.hide();
    }

    window.addEventListener('resize', () => {
        engine.resize()
    })

    engine.runRenderLoop(() => {
        scene.render()
    })

});