import { Color3, Engine, FollowCamera, FreeCamera, HavokPlugin, HemisphericLight, MeshBuilder, PhysicsAggregate, PhysicsImpostor, PhysicsShapeType, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { GridMaterial } from '@babylonjs/materials';
import HavokPhysics from "@babylonjs/havok";
import Car from "../doohickeys/car";

export async function createScene (engine: Engine, _canvas: HTMLCanvasElement): Promise<Scene> {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new Scene(engine);

    // Fisicas con havok
    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

    // Un poco de luz para que se vea algo
    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Crear el auto
    let car = new Car(scene, engine, new Vector3(0, 10, -180))

    // This creates and positions a free camera (non-mesh)
    var camera = new FollowCamera("camera1", new Vector3(0, 5, 10), scene, car.car);
    camera.rotationOffset = 180

    // Crear el piso
    let ground = MeshBuilder.CreateGroundFromHeightMap("ground", "./heightmap.jpg", {
        width: 1000, 
        height: 1000,
        minHeight: 0,
        maxHeight: 0,
        subdivisions: 64,
        onReady: (groundMesh) => {
            new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0, mesh: groundMesh }, scene);
        }
    })
    
    let groundMaterial = new GridMaterial("ground_material")
    groundMaterial.opacity = 1
    ground.material = groundMaterial

    scene.registerBeforeRender(() => {
        car.update()
    });

    return scene;
};
