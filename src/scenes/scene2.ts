import { Color3, Engine, FreeCamera, HavokPlugin, HemisphericLight, MeshBuilder, PhysicsAggregate, PhysicsShapeType, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import Car from "../doohickeys/car";

export async function createScene (engine: Engine, _canvas: HTMLCanvasElement): Promise<Scene> {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new Scene(engine);

    // Fisicas con havok
    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

    // This creates and positions a free camera (non-mesh)
    var camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(Vector3.Zero());

    // Un poco de luz para que se vea algo
    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Crear el auto
    let car = new Car(scene, engine, new Vector3(0, 10, 0))

    // Crear el piso
    let ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 } )
    let ground_material = new StandardMaterial("ground_material")
    ground_material.diffuseColor = new Color3(0.7, 0.5, 0.7)
    ground.material = ground_material
    new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0 }, scene);

    scene.registerBeforeRender(() => {
        car.update()
    });

    return scene;
};
