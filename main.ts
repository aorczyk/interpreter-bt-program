// MyMicrobit - code panel interpreter.
// Author: Adam Orczyk

type Commands = (number | number[] | number[][])[]

let commandsString = ''
let commands: Commands = []
let receivingCommand = false;
let forceStop = false;
let variables: number[] = [0,0,0]
let threadsNr = 0;
let keyCode: number = null;
let lastKeyCode: number = null;
let clapsNr: number = null;
let clapSound: number = null;

bluetooth.startUartService()

led.plot(2, 0)

// bluetooth.onBluetoothConnected(function () {
//     led.plot(1, 0)
// })

// bluetooth.onBluetoothDisconnected(function () {
//     basic.clearScreen()
//     led.plot(2, 0)
// })

function btSend(str: string | number) {
    bluetooth.uartWriteString(str + '\n')
}

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    messageHandler(bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)))
})

function messageHandler(receivedString: string) {
    let data = receivedString.split(';')
    lastKeyCode = keyCode
    keyCode = +data.join('')

    if (data[0] == '0') {
        forceStop = true;
    } else if (data[0] == '<'){
        receivingCommand = true
        commandsString = ''
        commands = []
        return
    } else if (data[0] == '>'){
        receivingCommand = false
        commands = JSON.parse(commandsString)
        basic.clearScreen()
        btSend('1')
    } else if (receivingCommand) {
        commandsString += data[0]
    } 
    else if (data[0] == '>>') {
        forceStop = false
        control.runInBackground(() => run(commands))
    }
}

function run(commands: Commands){
    threadsNr += 1
    for (let cmd of commands){
        runCommand(Array.isArray(cmd) ? cmd as number[] : [cmd as number])

        if (forceStop) {
            break;
        }
    }

    basic.pause(20)
    
    threadsNr -= 1
    if (threadsNr == 0){
        btSend(200)
    }
}

pfTransmitter.connectIrSenderLed(100) // AnalogPin.P0

function compare(a: number | null, t: number, b: number){
    t = t > 4 ? t - 4 : t;
    return a == null ? true : t == 1 ? a > b : t == 2 ? a < b : t == 3 ? a === b : t == 4 ? a !== b : false
}

// --- Data handlers ---
function getData(id: number, p1?: number, p2?: number){
    if (id == 1){
        return input.lightLevel()
    }
    else if (id == 2){
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
    else if (id == 8) {
        return variables[0]
    }
    else if (id == 9) {
        return variables[1]
    }
    else if (id == 10) {
        return variables[2]
    }
    else if (id == 11) {
        return pins.digitalReadPin(101); // DigitalPin.P1
    }
    else if (id == 12) {
        return sonar.ping(101, 102, 1)
    }
    else if (id == 13) {
        return keyCode
    }
    else if (id == 14) {
        return lastKeyCode
    }
    else if (id == 15) {
        if (clapsNr === null){
            clapsNr = 0;
            clapSound = input.soundLevel() + 50;

            control.runInBackground(() => {
                let triggerTime = 0;
                let noise = 0;
                let counter = 0;

                while (!forceStop) {
                    if (input.soundLevel() > clapSound) {
                        if (!noise){
                            noise = input.runningTime()
                            triggerTime = 0
                        }
                    } else {
                        // The duration of the clap is short.
                        if (input.runningTime() - noise < 300) {
                            counter += 1;
                            // Last claps nr is available for given time.
                            clapsNr = 0;
                            // Waiting 1s before set claps counter.
                            triggerTime = input.runningTime() + 1000
                        }
                        noise = 0
                    }

                    if (triggerTime && (input.runningTime() > triggerTime)){
                        clapsNr = counter;
                        counter = 0;
                        triggerTime = 0;
                    }

                    basic.pause(20)
                }

                clapsNr = null
            })
        }

        return clapsNr
    }
    else if (id == 16) {
        return pins.analogReadPin(101); // AnalogPin.P1
    }
    else if (id == -1) {
        return (input.runningTime() - p1) / 100
    }
    // else if (id == 17) {
    //     return Math.abs(input.acceleration(Dimension.X)) > 400 || Math.abs(input.acceleration(Dimension.Y)) > 400 ? 1 : 0
    // }
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
        return Math.randomRange(1,6)
    }
    // else if (id == 25) {
    //     return +input.isGesture(11)
    // }

    return null
}

function testConditions(conditions: Commands, p1?: number, p2?: number){
    let test = true;
    let op = null;

    for (let c of conditions as number[][]) {
        let data = c[0] == 20 ? p2 : getData(c[0], p1)
        let out = compare(data, c[1], c[1] < 5 ? c[2] : getData(c[2], p1))
        test = op == null ? out : op == 0 ? test && out : test || out;
        op = c[3]
    }

    return test
}

function plot(action: number, points: number[]){
    points.map(n => {
        let x = Math.trunc(n / 10)
        let y = Math.trunc(n - x * 10)
        action ? led.plot(x, y) : led.unplot(x, y)
    })
}

// --- Commands ---
function runCommand(cmd: Commands){
    let id = cmd[0];

    if (id == 0) {
        basic.clearScreen()
    } 
    else if (id == 1){
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
    // Repeat Block
    // Use this block to repeat actions.
    // Blocks placed inside the Repeat Block will be
    // looped.This can also be called the "loop
    // block." The loop can be repeated forever,
    // for a certain amount of time, or until
    // something happens.

    // Wait For
    // Use this block to tell the program to wait for
    // something to happen.It can wait for a set
    // amount of time or for input from a sensor.
    // This block always requires input in order to
    // work properly.

    else if (id == 5 || id == 6 || id == 16) {
        let c = cmd[1] as Commands;
        let p1 = input.runningTime();
        let p2 = 0;

        while (!forceStop) {
            if (!testConditions(c, p1, p2)){
                break;
            }

            if (cmd[2]){
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
        // Time trigger
        if (!cmd[6]){
            cmd[6] = input.runningTime()
        }

        if (testConditions(cmd[1] as Commands, cmd[6] as number)) {
            if (cmd[2] || !cmd[3] || cmd[3] == 2) {
                cmd[3] = 1
                run(cmd[4] as Commands)

                cmd[6] = input.runningTime()
            }
        } else {
            if (cmd[2] || cmd[3]) {
                cmd[3] = 0
                run(cmd[5] as Commands)
            }
        }
    }
    else if (id == 9) {
        let a = cmd[3] as number;
        let n = cmd[1] as number

        let v = variables[n]
        variables[n] = cmd[2] == 1 ? a : 
        cmd[2] == 2 ? v + a : 
        cmd[2] == 3 ? v - a : 
        cmd[2] == 4 ? getData(a) :
        cmd[2] == 5 ? v * a :
        cmd[2] == 6 ? v / a :
        // cmd[2] == 8 ? v - getData(a) :
        // cmd[2] == 9 ? v + getData(a) :
        // cmd[2] == 7 ? Math.abs(v) :
        0
    }
    else if (id == 10) {
        if (cmd[1] == 1){
            pins.setPull(101, 1) // PinPullMode.PullUp
        } 
        else if (cmd[1] == 2) {
            pins.setPull(101, 0)
        }
        // else if (cmd[1] == 3) {
        //     pins.setAudioPin(102)
        // }
        else if (cmd[1] == 4) {
            input.calibrateCompass()
        }
        else if (cmd[1] == 5) {
            clapSound = input.soundLevel() + 50;
        }
    }
    // else if (id == 11) {
    //     btSend(cmd[1] + ';')
    // }
    else if (id == 12) {
        forceStop = true
    }
    // else if (id == 13) {
    //     control.reset()
    // }
    else if (id == 14) {
        let trigger = true;
        control.runInBackground(() => {
            while (!forceStop) {
                if ((cmd[1] ? lastKeyCode : keyCode) == cmd[2] as number) {
                    if (trigger){
                        run(cmd[3] as Commands)
                        trigger = false;
                    }
                } else {
                    trigger = true;
                }

                basic.pause(20)
            }
        })
    }
    // else if (id == 15) {
    //     music.playTone(cmd[1] as number, music.beat())
    //     basic.pause(cmd[2] as number * 100)
    // }
    else if (id == 16) {
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

// const enum PfChannel {
//     //% block="1"
//     Channel1 = 0,
//     //% block="2"
//     Channel2 = 1,
//     //% block="3"
//     Channel3 = 2,
//     //% block="4"
//     Channel4 = 3,
// }

// const enum PfOutput {
//     Red = 0,
//     Blue = 1
// }

// const enum PfSingleOutput {
//     //% block="Float"
//     Float = 0b1000000,
//     //% block="Forward step 1"
//     Forward1 = 0b1000001,
//     //% block="Forward step 2"
//     Forward2 = 0b1000010,
//     //% block="Forward step 3"
//     Forward3 = 0b1000011,
//     //% block="Forward step 4"
//     Forward4 = 0b1000100,
//     //% block="Forward step 5"
//     Forward5 = 0b1000101,
//     //% block="Forward step 6"
//     Forward6 = 0b1000110,
//     //% block="Forward step 7"
//     Forward7 = 0b1000111,
//     //% block="Brake then float"
//     BrakeThenFloat = 0b1001000,
//     //% block="Backward step 7"
//     Backward7 = 0b1001001,
//     //% block="Backward step 6"
//     Backward6 = 0b1001010,
//     //% block="Backward step 5"
//     Backward5 = 0b1001011,
//     //% block="Backward step 4"
//     Backward4 = 0b1001100,
//     //% block="Backward step 3"
//     Backward3 = 0b1001101,
//     //% block="Backward step 2"
//     Backward2 = 0b1001110,
//     //% block="Backward step 1"
//     Backward1 = 0b1001111,

//     //% block="Increment"
//     IncrementPWM = 0b1100100,
//     //% block="Decrement"
//     DecrementPWM = 0b1100101,
//     //% block="Full forward"
//     FullForward = 0b1100110,
//     //% block="Full backward"
//     FullBackward = 0b1100111,

//     //% block="Toggle full forward/backward (default forward)"
//     ToggleFullForwardBackward = 0b1101000,

//     //% block="Toggle full forward (Stop → Fw, Fw → Stop, Bw → Fw)"
//     ToggleFullForward = 0b1100000,
//     //% block="Toggle full backward (Stop → Bw, Bw → Stop, Fwd → Bw)"
//     ToggleFullBackward = 0b1101111,

//     //% block="Toggle direction"
//     ToggleDirection = 0b1100001,
//     //% block="Increment Numerical PWM"
//     IncrementNumericalPWM = 0b1100010,
//     //% block="Decrement Numerical PWM"
//     DecrementNumericalPWM = 0b1100011,

//     //% block="Clear C1 (negative logic – C1 high)"
//     ClearC1 = 0b1101001,
//     //% block="Set C1 (negative logic – C1 low)"
//     SetC1 = 0b1101010,
//     //% block="Toggle C1"
//     ToggleC1 = 0b1101011,

//     //% block="Clear C2 (negative logic – C2 high)"
//     ClearC2 = 0b1101100,
//     //% block="Set C2 (negative logic – C2 low)"
//     SetC2 = 0b1101101,
//     //% block="Toggle C2"
//     ToggleC2 = 0b1101110,
// }

//% color=#f68420 icon="\uf1eb" block="PF Transmitter"
namespace pfTransmitter {
    let irLed: InfraredLed;
    let toggleByChannel: number[];
    let schedulerIsWorking: boolean;
    let tasks: task[];
    let intervalId: number[];
    export let lastCommand: number;

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
    }

    function getRandomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function addToggle(command: number) {
        let channel = (0b001100000000 & command) >>> 8;
        toggleByChannel[channel] = 1 - toggleByChannel[channel];

        return (toggleByChannel[channel] << 11) | command;
    }

    function sendPacket(command: number, mixDatagrams: boolean = false) {
        let taskType = 0b001100110000 & command;
        command = addToggle(command);
        lastCommand = command;

        if (mixDatagrams) {
            // Prevents from mixing two commands to the same output ex. start and stop.
            while (tasks.filter(x => { return x.type == taskType }).length > 0) {
                basic.pause(20)
            }
        }

        // "Five exactly matching messages (if no other buttons are pressed or released) are sent ... ."
        // "(if no other buttons are pressed or released)" - this is not handle now, every command is sent one by one or mixed. It should be handled by receiver.
        for (let i = 0; i < settings.signalRepeatNumber; i++) {
            tasks.push({
                handler: () => {
                    irLed.sendCommand(command)
                },
                type: taskType
            })
        }

        // Pause after each command packet - seems not needed.
        // if (!mixDatagrams) {
        //     tasks.push({
        //         handler: () => {},
        //         type: taskType
        //     })
        // }

        if (!schedulerIsWorking) {
            schedulerIsWorking = true;

            control.inBackground(function () {
                while (tasks.length > 0) {
                    let i = 0;
                    if (mixDatagrams) {
                        i = getRandomInt(0, tasks.length - 1);
                    }
                    tasks[i].handler();
                    tasks.splice(i, 1);

                    // Pause time after each signal.
                    basic.pause(settings.afterSignalPause)
                }

                schedulerIsWorking = false;
            })
        }
    }

    /**
     * Connects to the IR-emitting diode at the specified pin. Warning! The light (solar or lamp) falling on the diode or ir receiver interferes with the signal transmission.
     * @param pin IR diode pin, eg: AnalogPin.P0
     * @param debug turn on debug mode if set to true (false by default), eg: false
     */
    //% blockId="pf_transmitter_infrared_sender_connect"
    //% block="connect IR sender diode at pin %pin || debug %debug"
    //% pin.fieldEditor="gridpicker"
    //% pin.fieldOptions.columns=4
    //% pin.fieldOptions.tooltips="false"
    //% weight=90
    export function connectIrSenderLed(pin: AnalogPin): void {
        toggleByChannel = [1, 1, 1, 1];
        schedulerIsWorking = false;
        tasks = [];
        intervalId = [null, null, null, null];
        settings = {
            repeatCommandAfter: 500,
            afterSignalPause: 0,
            signalRepeatNumber: 5
        }

        irLed = new InfraredLed(pin);
    }

    /**
     * Single output mode (speed remote control).
     * This mode is able to control: one output at a time with PWM or clear/set/toggle control pins.
     * This mode has no timeout for lost IR on all commands except "full forward" and "full backward".
     * @param channel the PF receiver channel, eg: PfChannel.Channel1
     * @param output the PF receiver output, eg: PfOutput.Red
     * @param command the Single Output Mode command, eg: PfSingleOutput.Float
     */
    //% blockId="pf_transmitter_single_output_mode"
    //% block="set speed : channel %channel output %output command %command"
    //% weight=80
    export function singleOutputMode(channel: number, output: number, command: number) {
        let mixDatagrams = true;

        // Because: Toggle bit is verified on receiver if increment/decrement/toggle command is received.
        if ([0b1100100, 0b1100101].some(x => x == command)) {
            mixDatagrams = false
        }

        sendPacket((channel << 8) | command | (output << 4), mixDatagrams)
    }
}