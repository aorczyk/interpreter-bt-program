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

bluetooth.startUartService()

led.plot(0, 0)

bluetooth.onBluetoothConnected(function () {
    led.plot(1, 0)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.clearScreen()
    led.plot(0, 0)
})

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
        basic.clearScreen()
        commandsString = ''
        commands = []
        return
    } else if (data[0] == '>'){
        receivingCommand = false
        commands = JSON.parse(commandsString)
        // led.plot(4, 0)
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

pfTransmitter.connectIrSenderLed(AnalogPin.P0)

function compare(a: number, t: number, b: number){
    t = t > 4 ? t - 4 : t;
    return t == 1 ? a > b : t == 2 ? a < b : t == 3 ? a === b : t == 4 ? a !== b : false
}

// --- Data handlers ---
function getData(id: number, p1?: number){
    if (id == 1){
        return input.lightLevel()
    }
    else if (id == 2){
        return input.soundLevel()
    }
    else if (id == 3) {
        return input.acceleration(Dimension.X)
    }
    else if (id == 4) {
        return input.acceleration(Dimension.Y)
    }
    else if (id == 5) {
        return input.acceleration(Dimension.Z)
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
        return pins.digitalReadPin(DigitalPin.P1);
    }
    else if (id == 12) {
        return sonar.ping(DigitalPin.P1, DigitalPin.P2, PingUnit.Centimeters)
    }
    else if (id == 13) {
        return keyCode
    }
    else if (id == 14) {
        return lastKeyCode
    }
    else if (id == 15) {
        if (clapsNr === null){
            clapsNr = 0
            let lastClaps: number = 0;
            let wasNoise: boolean = false;
            let counter: number = 0;

            control.runInBackground(() => {
                while (!forceStop) {
                    let sound = input.soundLevel()
                    // let sound = input.lightLevel()
                    if (sound > 100){
                        if (!wasNoise) {
                            wasNoise = true
                            counter += 1;
                            lastClaps = input.runningTime()
                        }
                    } else {
                        wasNoise = false
                    }

                    if ((input.runningTime() - lastClaps) > 1000){
                        clapsNr = counter;
                        counter = 0;
                    }
                    basic.pause(20)
                }

                clapsNr = null
            })
        }

        return clapsNr
    }
    else if (id == 16) {
        return pins.analogReadPin(AnalogPin.P1);
    }
    else if (id == -1) {
        return (input.runningTime() - p1) / 100
    }
    else if (id == 17) {
        return Math.abs(input.acceleration(Dimension.X)) > 400 || Math.abs(input.acceleration(Dimension.Y)) > 400 ? 1 : 0
    }
    else if (id == 18) {
        return input.buttonIsPressed(Button.A) ? 1 : 0
    }
    else if (id == 19) {
        return input.buttonIsPressed(Button.B) ? 1 : 0
    }

    return 0
}

function testConditions(conditions: Commands, p1?: number){
    let test = true;
    let op = null;

    for (let c of conditions as number[][]) {
        let out = compare(getData(c[0], p1), c[1], c[1] < 5 ? c[2] : getData(c[2], p1))
        test = op == null ? out : op == 0 ? test && out : test || out;
        op = c[3]
    }

    return test
}

function plot(points: number[], action: number){
    for (let n of points) {
        let x = Math.trunc(n)
        let y = Math.trunc((n - x) * 10)
        if (action){
            led.plot(x, y)
        } else {
            led.unplot(x, y)
        }
    }
}

// --- Commands ---
function runCommand(cmd: Commands){
    let id = cmd[0];

    if (id == 0) {
        basic.clearScreen()
    } 
    else if (id == 1){
        let data = [input.runningTime()]
        for (let i = 1; i < cmd.length; i++){
            data.push(getData(cmd[i] as number))
        }
        btSend(data.join(','))
    }
    else if (id == 2) {
        led.plot(cmd[1] as number, cmd[2] as number)
        // let p1 = cmd[1] as number[];
        // plot(cmd[1] as number[], cmd[2] as number)
    } else if (id == 3) {
        led.unplot(cmd[1] as number, cmd[2] as number)
    } else if (id == 4) {
        pfTransmitter.singleOutputMode(cmd[1] as PfChannel, cmd[2] as PfOutput, cmd[3] as PfSingleOutput)
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
        let startWait = input.runningTime();
        
        while (!forceStop) {
            if (!testConditions(cmd[1] as Commands, startWait)){
                break;
            }

            if (cmd[2]){
                run(cmd[2] as Commands)
            }

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
        let a = cmd[3] as number;
        let n = cmd[1] as number;
        if (cmd[2] == 1) {
            variables[n] = a
        } else if (cmd[2] == 2) {
            variables[n] += a
        } else if (cmd[2] == 3) {
            variables[n] -= a
        } else if (cmd[2] == 4) {
            variables[n] = getData(a)
        }
    }
    else if (id == 10) {
        if (cmd[1] == 1){
            pins.setPull(DigitalPin.P1, PinPullMode.PullUp)
        } 
        else if (cmd[1] == 2) {
            pins.setPull(DigitalPin.P1, PinPullMode.PullDown)
        }
        // else if (cmd[1] == 3) {
        //     pins.setAudioPin(AnalogPin.P2)
        // }
    }
    // else if (id == 11) {
    //     btSend(cmd[1] + ';')
    // }
    // else if (id == 12) {
    //     forceStop = true
    // }
    // else if (id == 13) {
    //     control.reset()
    // }
    else if (id == 14) {
        let p1 = cmd[1] as number;
        let trigger = true;
        control.runInBackground(() => {
            while (!forceStop) {
                if (keyCode == p1) {
                    if (trigger){
                        run(cmd[2] as Commands)
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
}