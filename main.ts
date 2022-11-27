bluetooth.startUartService()

led.plot(0, 0)

bluetooth.onBluetoothConnected(function () {
    led.plot(1,0)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.clearScreen()
    led.plot(0, 0)
})

function btSend(str: string){
    bluetooth.uartWriteString(str + '\n')
}

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
        messageHandler(bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine)))
})

type Commands = (number | number[])[]

let commandsString = ''
let commands: Commands = []
let receivingCommand = false;
let forceStop = false;
let variables: number[] = []
let runningNr = 0;

function messageHandler(receivedString: string) {
    let data = receivedString.split(';')

    if (data[0] == '0') {
        forceStop = true;
        btSend('0\n')
    } else if (data[0] == '<'){
        receivingCommand = true
        basic.clearScreen()
        commandsString = ''
        commands = []
        return
    } else if (data[0] == '>'){
        receivingCommand = false
        led.plot(2, 0)
        btSend('1\n')
        return
    } else if (receivingCommand) {
        commandsString += data[0]
    } else if (data[0] == '>>') {
        forceStop = false
        if (commandsString) {
            commands = JSON.parse(commandsString)

            control.runInBackground(() => run(commands))
        }
    }
}

function run(commands: Commands){
    runningNr += 1
    for (let cmd of commands){
        runCommand(Array.isArray(cmd) ? cmd as number[] : [cmd as number])()

        if (forceStop) {
            break;
        }
    }

    runningNr -= 1
    if (runningNr == 0){
        btSend('E' + runningNr)
    }
}

pfTransmitter.connectIrSenderLed(AnalogPin.P0)

function compare(a: number, t: number, b: number){
    return (t == 1) ? a > b : (t == 2) ? a < b : (t == 3) ? a == b : false
}

function getData(id: number){
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

    return 0
}

function runCommand(cmd: Commands){
    let id = cmd[0];

    if (id == 0) {
        return () => {
            basic.clearScreen()
        }
    } 
    else if (id == 1){
        return () => {
            let data = [input.runningTime()]
            for (let i = 1; i < cmd.length; i++){
                data.push(getData(cmd[i] as number))
            }
            btSend(data.join(',') + '\n')
        }
    }
    else if (id == 2) {
        return () => {
            led.plot(cmd[1] as number, cmd[2] as number)
        }
    } else if (id == 3) {
        return () => {
            led.unplot(cmd[1] as number, cmd[2] as number)
        }
    } else if (id == 4) {
        return () => {
            let pfCommand: PfSingleOutput;

            if (cmd[3] == 0) {
                pfCommand = PfSingleOutput.Float
            } else if (cmd[3] == 1) {
                pfCommand = PfSingleOutput.Forward1
            } else if (cmd[3] == 2) {
                pfCommand = PfSingleOutput.Forward2
            } else if (cmd[3] == 3) {
                pfCommand = PfSingleOutput.Forward3
            } else if (cmd[3] == 4) {
                pfCommand = PfSingleOutput.Forward4
            } else if (cmd[3] == 5) {
                pfCommand = PfSingleOutput.Forward5
            } else if (cmd[3] == 6) {
                pfCommand = PfSingleOutput.Forward6
            } else if (cmd[3] == 7) {
                pfCommand = PfSingleOutput.Forward7
            } else if (cmd[3] == 8) {
                pfCommand = PfSingleOutput.Backward1
            } else if (cmd[3] == 9) {
                pfCommand = PfSingleOutput.Backward2
            } else if (cmd[3] == 10) {
                pfCommand = PfSingleOutput.Backward3
            } else if (cmd[3] == 11) {
                pfCommand = PfSingleOutput.Backward4
            } else if (cmd[3] == 12) {
                pfCommand = PfSingleOutput.Backward5
            } else if (cmd[3] == 13) {
                pfCommand = PfSingleOutput.Backward6
            } else if (cmd[3] == 14) {
                pfCommand = PfSingleOutput.Backward7
            } else if (cmd[3] == 15) {
                pfCommand = PfSingleOutput.BrakeThenFloat
            }
            
            pfTransmitter.singleOutputMode(cmd[1] as PfChannel, cmd[2] as PfOutput, pfCommand)
        }
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

    else if (id == 5 || id == 6) {
        return () => {
            let p1 = cmd[1] as number;
            let p2 = cmd[2] as number;
            let p3 = cmd[3] as number;
            let st = input.runningTime();
            
            let condition = true;

            while (!forceStop && condition) {
                if (p1) {
                    condition = compare(
                        p1 == 1 ? (input.runningTime() - st) / 1000 : getData(p1 - 1),
                        p2, 
                        p3
                    )

                    if (!condition){
                        break;
                    }
                }

                if (cmd[4]){
                    run(cmd[4] as Commands)
                }

                basic.pause(20)
            }
        }
    }
    else if (id == 7) {
        return () => {
            control.runInBackground(() => {
                run(cmd[1] as Commands)
            })
        }
    }
    else if (id == 8) {
        // control.runInBackground(() => {
        let isTrue = false;
        return () => {

            // while (!forceStop) {
                if (compare(
                    getData(cmd[1] as number),
                    cmd[2] as number,
                    cmd[3] as number
                )) {
                    if (!isTrue) {
                        isTrue = true
                        run(cmd[4] as Commands)
                    }
                } else {
                    isTrue = false
                }

                basic.pause(20)
            // }
        // })
        }
    }
    else if (id == 9) {
        return () => {
            let a = cmd[3] as number;
            if (cmd[2] == 1) {
                variables[cmd[1] as number] = a
            } else if (cmd[2] == 2) {
                variables[cmd[1] as number] += a
            } else if (cmd[2] == 3) {
                variables[cmd[1] as number] -= a
            }
        }
    }

    return () => {}
}

// input.onButtonPressed(Button.A, function() {
//     // commands = [0, [2, 0, 0], [5, 1, 1, 10, [[2, 0, 0], [1, 1], [3, 0, 0], [1, 1]]], [2, 1, 1]] as Commands;
//     // commands = [0, [5, 2, 2, 100, [[2, 0, 0], [1, 1], [3, 0, 0], [1, 1]]], [2, 1, 1]] as Commands;
//     commands = [0, [6, 2, 2, 50], [2, 1, 1]] as Commands;
//     run(commands)
// })