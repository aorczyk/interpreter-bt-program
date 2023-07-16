/**
 * MyMicrobit - program interpreter.
 *
 * (c) 2023, Adam Orczyk
 */

type Commands = (number | number[] | number[][])[]

let commandsString = ''
let commands: Commands = []
let receivingCommand = false;
let forceStop = false;
let variables: number[] = [0, 0, 0]
let threadsNr = 0;
let pressedKeys: number[] = [];
let lastPressedKeys: { [key: number]: boolean } = {};

// let clapsNr: number = null;
// let clapSound: number = null;

bluetooth.startUartService()
pfTransmitter.connectIrSenderLed(100) // AnalogPin.P0

led.plot(2, 0)

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    messageHandler(bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)))
})

function btSend(str: string | number) {
    bluetooth.uartWriteString(str + '\n')
}

function messageHandler(receivedString: string) {
    let data = receivedString ? receivedString.split(';') : []

    if (data[0] == '0') {
        forceStop = true;
    } else if (data[0] == '-v') {
        btSend('v1.0.2')
    } else if (data[0] == '<') {
        commands = []
        receivingCommand = true
    } else if (data[0] == '>') {
        receivingCommand = false
        commands = JSON.parse(commandsString)
        commandsString = ''
        basic.clearScreen()
        btSend('1')
        forceStop = false
        control.runInBackground(() => run(commands))
    } else if (receivingCommand) {
        commandsString += data[0]
    }
    //  else if (data[0] == '>>') {
    //     forceStop = false
    //     control.runInBackground(() => run(commands))
    // } 
    else {
        // Keyboard control.
        if (!pressedKeys.length) {
            lastPressedKeys = {}
        }
        for (let k of pressedKeys) {
            lastPressedKeys[k] = true
        }
        pressedKeys = data.map(x => +x)
        for (let k of pressedKeys) {
            lastPressedKeys[k] = false
        }
    }
}

function run(commands: Commands) {
    threadsNr += 1
    for (let cmd of commands) {
        runCommand(Array.isArray(cmd) ? cmd as number[] : [cmd as number])

        if (forceStop) {
            break;
        }
    }

    basic.pause(20)

    threadsNr -= 1
    if (threadsNr == 0) {
        btSend(200)
    }
}

function compare(a: any | any[] | null, t: number, b: any | any[]) {
    t = t > 4 ? t - 4 : t;
    return a == null ? true : t == 1 ? a > b : t == 2 ? a < b : t == 3 ? a === b : t == 4 ? a !== b : false
}

// --- Data handlers ---
function getData(id: number, p1: number = 0, p2?: number) {
    if (id == 1) {
        return input.lightLevel()
    }
    else if (id == 2) {
        return input.soundLevel()
    }
    else if (id >= 3 && id <= 5) {
        return input.acceleration(id - 3)
    }
    else if (id == 6) {
        return input.compassHeading()
    }
    else if (id == 7) {
        return input.temperature()
    }
    else if (id == -1) {
        return (input.runningTime() - p1) / 100
    }
    else if (id == 18) {
        return + input.buttonIsPressed(Button.A)
    }
    else if (id == 19) {
        return + input.buttonIsPressed(Button.B)
    }
    else if (id == 21) {
        return input.magneticForce(0)
    }
    else if (id == 22) {
        return input.magneticForce(1)
    }
    else if (id == 23) {
        return input.magneticForce(2)
    }
    else if (id == 24) {
        return Math.randomRange(1, 6)
    }
    else if (id >= 70) {
        return pins.digitalReadPin(id + 30);
    }
    else if (id >= 60) {
        return pins.analogReadPin(id + 40);
    }
    else if (id >= 50) {
        return variables[id - 50]
    }
    // --- Custom input 1 ---

    else if (id == 31) {
        return sonar.ping(101, 102, 1)
    }

    // --- Custom input 2 ---

    // else if (id == 32) {
    //     if (clapsNr === null){
    //         clapsNr = 0;
    //         clapSound = input.soundLevel() + 50;

    //         control.runInBackground(() => {
    //             let triggerTime = 0;
    //             let noise = 0;
    //             let counter = 0;

    //             while (!forceStop) {
    //                 if (input.soundLevel() > clapSound) {
    //                     if (!noise){
    //                         noise = input.runningTime()
    //                         triggerTime = 0
    //                     }
    //                 } else {
    //                     // The duration of the clap is short.
    //                     if (input.runningTime() - noise < 300) {
    //                         counter += 1;
    //                         // Last claps nr is available for given time.
    //                         clapsNr = 0;
    //                         // Waiting 1s before set claps counter.
    //                         triggerTime = input.runningTime() + 1000
    //                     }
    //                     noise = 0
    //                 }

    //                 if (triggerTime && (input.runningTime() > triggerTime)){
    //                     clapsNr = counter;
    //                     counter = 0;
    //                     triggerTime = 0;
    //                 }

    //                 basic.pause(20)
    //             }

    //             clapsNr = null
    //         })
    //     }

    //     return clapsNr
    // }

    // --- Custom input 3 ---

    // else if (id == 33) {
    // }

    return null
}

function testConditions(conditions: Commands, p1?: number, p2?: number) {
    let test = true;
    let operator = null;

    for (let i = 0; i < conditions.length; i++) {
        let c = conditions[i] as Commands;
        let out;
        if (c[0] == 13 || c[0] == 14) {
            out = checkKeysPressed(c[0] as number, c[2] as number[])
            out = c[1] == 4 ? !out : out
        } else {
            let data = c[0] == 20 ? p2 : getData(c[0] as number, p1)
            out = compare(data, c[1] as number, c[1] < 5 ? c[2] : getData(c[2] as number, p1))
        }

        test = operator == null ? out : operator == 0 ? test && out : test || out;
        operator = c[3]
    }

    return test
}

function plot(action: number, points: number[]) {
    points.map(n => {
        let x = Math.trunc(n / 10)
        let y = Math.trunc(n - x * 10)
        action ? led.plot(x, y) : led.unplot(x, y)
    })
}

function checkKeysPressed(operator: number, pattern: number[]) {
    return operator == 14 ? pattern.every(elem => lastPressedKeys[elem]) : pattern.every(elem => pressedKeys.indexOf(elem) != -1);
}

// --- Commands ---
function runCommand(cmd: Commands) {
    let id = cmd[0];

    if (id == 0) {
        basic.clearScreen()
    }
    else if (id == 1) {
        let data = cmd.map(x => getData(x as number));
        data[0] = input.runningTime()
        btSend(data.join(','))
    }
    else if (id == 102) {
        plot(cmd[1] as number, cmd[2] as number[])
    }
    else if (id == 4) {
        pfTransmitter.singleOutputMode(cmd[1] as number, cmd[2] as number, cmd[3] as number)
    }
    else if (id == 5) { // || id == 6 || id == 16
        let c = cmd[1] as Commands;
        let p1 = input.runningTime();
        let p2 = 0;

        while (!forceStop) {
            if (!testConditions(c, p1, p2)) {
                break;
            }

            if (cmd[2]) {
                run(cmd[2] as Commands)
            }

            p2 += 1
            basic.pause(20)
        }
    }
    else if (id == 7) {
        control.runInBackground(() => {
            run(cmd[1] as Commands)
        })
    }
    else if (id == 8) {
        if (testConditions(cmd[1] as Commands)) {
            if (cmd[2] || !cmd[3] || cmd[3] == 2) {
                cmd[3] = 1
                run(cmd[4] as Commands)
            }
        } else {
            if (cmd[2] || cmd[3]) {
                cmd[3] = 0
                run(cmd[5] as Commands)
            }
        }
    }
    else if (id == 9) {
        let n = cmd[1] as number - 50;
        let p = cmd[2] as number;
        let a = cmd[3] as number;
        let v = variables[n];

        if (p > 10) {
            a = getData(a) as number;
            p = p - 10
        }

        variables[n] = p == 1 ? a :
            p == 2 ? v + a :
                p == 3 ? v - a :
                    p == 4 ? v * a :
                        p == 5 ? v / a :
                            0
    }
    // PinPullMode
    else if (id == 10) {
        pins.setPull(cmd[1] as number, cmd[2] as number)
    }
    else if (id == 12) {
        forceStop = true
    }
    else if (id == 19) {
        control.reset()
    }
    else if (id == 15) {
        music.setVolume(cmd[4] as number)
        music.playTone(cmd[1] as number || cmd[2] as number, cmd[3] as number * 100)
        basic.pause(cmd[5] as number * 100)
    }
    // --- Custom command ---
    // else if (id == 17) {
    // }
    else if (id == 18) {
        pins.analogWritePin(cmd[1] as number, cmd[2] as number)
    }
}

// --- Power Functions Transmitter - SingleOutput ---

/**
 * Power Functions Transmitter - programmable remote control.
 * Sending commands to LEGO Power Functions infrared receiver.
 * 
 * LEGO Power Functions RC documentation: https://www.philohome.com/pf/LEGO_Power_Functions_RC.pdf
 * 
 * (c) 2021, Adam Orczyk
 */

namespace pfTransmitter {
    let irLed: InfraredLed;
    let toggleByChannel: number[];
    let schedulerIsWorking: boolean;
    let tasks: task[];
    let intervalId: number[];
    export let lastCommand: number;
    let mixDatagrams = false;

    type Settings = {
        repeatCommandAfter: number,
        afterSignalPause: number,
        signalRepeatNumber: number,
    }

    let settings: Settings;

    class InfraredLed {
        private pin: AnalogPin;
        private waitCorrection: number;

        constructor(pin: AnalogPin) {
            this.pin = pin;
            pins.analogWritePin(this.pin, 0);
            pins.analogSetPeriod(this.pin, 26);

            // Measure the time we need for a minimal bit (analogWritePin and waitMicros)
            {
                const start = input.runningTimeMicros();
                const runs = 32;
                for (let i = 0; i < runs; i++) {
                    this.transmitBit(1, 1);
                }
                const end = input.runningTimeMicros();
                this.waitCorrection = Math.idiv(end - start - runs * 2, runs * 2);
            }

            // Insert a pause between callibration and first message
            control.waitMicros(2000);
        }

        public transmitBit(highMicros: number, lowMicros: number): void {
            pins.analogWritePin(this.pin, 511);
            control.waitMicros(highMicros);
            pins.analogWritePin(this.pin, 1);
            control.waitMicros(lowMicros);
        }

        // 12 bits of datagram
        public sendCommand(command: number) {
            let nibble1 = command >>> 8;
            let nibble2 = (command & 0b000011110000) >>> 4;
            let nibble3 = (command & 0b000000001111);
            let lrc = 15 ^ nibble1 ^ nibble2 ^ nibble3;

            this.sendDatagram((command << 4) | lrc)
        }

        public sendDatagram(datagram: number): void {
            const PF_MARK_BIT = 158;
            const PF_LOW_BIT = 421 - PF_MARK_BIT - this.waitCorrection;
            const PF_HIGH_BIT = 711 - PF_MARK_BIT - this.waitCorrection;
            const PF_START_BIT = 1184 - PF_MARK_BIT - this.waitCorrection;

            let bits = '';

            this.transmitBit(PF_MARK_BIT, PF_START_BIT);

            for (let i = 15; i >= 0; i--) {
                let bit = (datagram & (1 << i)) === 0 ? 0 : 1;

                if (bit == 0) {
                    this.transmitBit(PF_MARK_BIT, PF_LOW_BIT);
                } else if (bit == 1) {
                    this.transmitBit(PF_MARK_BIT, PF_HIGH_BIT);
                }
            }

            this.transmitBit(PF_MARK_BIT, PF_START_BIT);
        }
    }

    // --- Command sender ---
    // To achieve greater parallelization of signals, mixes ir signals when more than one command is run one by one.

    interface task {
        handler: () => void;
        type: number;
        counter: number;
    }

    function addToggle(command: number) {
        let channel = (0b001100000000 & command) >>> 8;
        toggleByChannel[channel] = 1 - toggleByChannel[channel];

        return (toggleByChannel[channel] << 11) | command;
    }

    function sendPacket(command: number, mix: boolean = false) {
        mixDatagrams = mix;
        let taskType = 0b001100110000 & command;
        command = addToggle(command);
        lastCommand = command;

        if (mixDatagrams) {
            // Prevents from mixing two commands to the same output ex. start and stop.
            while (tasks.some(x => x.type == taskType)) {
                basic.pause(20) // Passes control to the micro:bit scheduler. https://makecode.microbit.org/device/reactive
            }
        }

        // "Five exactly matching messages (if no other buttons are pressed or released) are sent ... ."
        // "(if no other buttons are pressed or released)" - this is not handle now, every command is sent one by one or mixed. It should be handled by receiver.
        tasks.push({
            handler: () => {
                irLed.sendCommand(command)
            },
            type: taskType,
            counter: settings.signalRepeatNumber
        })

        if (!schedulerIsWorking) {
            schedulerIsWorking = true;

            control.inBackground(function () {
                let i = 0;
                while (tasks.length > 0) {
                    tasks[i].handler();
                    tasks[i].counter -= 1;
                    if (!tasks[i].counter) {
                        tasks.splice(i, 1);
                    }

                    // Pause time after each signal to process it by IR receiver.
                    basic.pause(settings.afterSignalPause)

                    i = (mixDatagrams && i < tasks.length - 1) ? i + 1 : 0;
                }

                schedulerIsWorking = false;
            })
        }
    }

    export function connectIrSenderLed(pin: AnalogPin): void {
        toggleByChannel = [1, 1, 1, 1];
        schedulerIsWorking = false;
        tasks = [];
        intervalId = [null, null, null, null];
        settings = {
            repeatCommandAfter: 500,
            afterSignalPause: 10,
            signalRepeatNumber: 5
        }

        irLed = new InfraredLed(pin);
    }

    export function singleOutputMode(channel: number, output: number, command: number) {
        // Because: Toggle bit is verified on receiver if increment/decrement/toggle command is received.
        sendPacket((channel << 8) | command | (output << 4), !(0b1100100 == command || 0b1100101 == command))
    }
}