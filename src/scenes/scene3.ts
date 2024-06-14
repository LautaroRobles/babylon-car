import { Color3, Engine, FollowCamera, FreeCamera, HavokPlugin, HemisphericLight, KeyboardEventTypes, MeshBuilder, PhysicsAggregate, PhysicsImpostor, PhysicsShapeType, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { GridMaterial } from '@babylonjs/materials';
import HavokPhysics from "@babylonjs/havok";
import Car from "../doohickeys/car/Car";
import Tire from "../doohickeys/car/Tire";

// No es necesario crear las escenas de esta manera pero lo hago asi porque es lo mas facil
export async function createScene (engine: Engine): Promise<Scene> {

    // This creates a basic Babylon Scene object (non-mesh)
    const scene = new Scene(engine);

    // Fisicas con havok
    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

    const physicsEngine = scene.getPhysicsEngine()!!

    // Un poco de luz para que se vea algo
    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    const tireMesh = MeshBuilder.CreateCylinder("tire", { height: 0.1, diameter: 1 })
    tireMesh.rotation = new Vector3(0, 0, Math.PI / 2)

    // Crear el auto
    const car = new Car("car1", scene, engine, physicsEngine, {
        dimensions: {
            width: 1.7,
            height: 1.4,
            size: 4.6,
        },
        mass: 1354,
        acceleration: {
            topSpeedKmh: 200,
            engineStrenght: 10000,
            brakingStrength: 500,
            deaccelerationStrength: 50,
        },
        steering: {
            maxRotationAngle: 35,
        },
        suspension: {
            rayLength: 1.4,
            restDistance: 1.2,
            springStrength: 20000,
            springDamp: 2000,
        },
        tires: [
            new Tire({ position: new Vector3(-0.9, -0.2,  2.3), canThrust: false, canRotate: true , gripFactor: 1000, mesh: tireMesh.clone("tire1") }),
            new Tire({ position: new Vector3( 0.9, -0.2,  2.3), canThrust: false, canRotate: true , gripFactor: 1000, mesh: tireMesh.clone("tire2") }),
            new Tire({ position: new Vector3(-0.9, -0.2, -2.3), canThrust: true , canRotate: false, gripFactor: 1000, mesh: tireMesh.clone("tire3") }),
            new Tire({ position: new Vector3( 0.9, -0.2, -2.3), canThrust: true , canRotate: false, gripFactor: 1000, mesh: tireMesh.clone("tire4") }),
        ]
    })
    car.carBody.disablePreStep = true
    car.position = new Vector3(0, 20, 0)
    car.carBody.disablePreStep = false

    // This creates and positions a free camera (non-mesh)
    const camera = new FollowCamera("camera1", new Vector3(0, 5, 10), scene, car.carMesh);
    camera.rotationOffset = 180

    // Crear el piso a partir de un heightmap de la carpeta /public
    let ground = MeshBuilder.CreateGroundFromHeightMap("ground", "heightmap.jpg", {
        width: 1000, 
        height: 1000,
        minHeight: 0,
        maxHeight: 30,
        subdivisions: 64,
        onReady: (groundMesh) => {
            // Cuando se termina de generar la mesh creamos el PhysicsBody y PhisicsShape
            new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0, mesh: groundMesh }, scene);
        }
    })
    
    // Creamos un material de grid para el ground
    ground.material = new GridMaterial("ground_material")

    // Registrar inputs
    scene.onKeyboardObservable.add((kbInfo) => {
        switch (kbInfo.type) {
            case KeyboardEventTypes.KEYDOWN:
                switch (kbInfo.event.key) {
                    case "a":
                        car.inputs.rotationAngleChange = -2
                        break;
                    case "d":
                        car.inputs.rotationAngleChange = 2
                        break;
                    case "w":
                        car.inputs.accelerationInput = 1
                        break;
                    case "s":
                        car.inputs.accelerationInput = -1                                                         
                        break;
                }
                break;
            case KeyboardEventTypes.KEYUP:
                switch (kbInfo.event.key) {
                    case "a":
                        car.inputs.rotationAngleChange = 0
                        break;
                    case "d":
                        car.inputs.rotationAngleChange = 0
                        break;
                    case "w":
                        car.inputs.accelerationInput = 0
                        break;
                    case "s":
                        car.inputs.accelerationInput = 0                                                         
                        break;
                }
                break;
        }
    });

    // Actualizamos el auto en cada fotograma
    scene.registerBeforeRender(() => {
        car.update()
    });

    return scene;
};
