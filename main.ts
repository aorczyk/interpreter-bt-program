bluetooth.startUartService()

basic.showIcon(IconNames.Square)

bluetooth.onBluetoothConnected(function () {
    basic.showIcon(IconNames.Yes)
})

bluetooth.onBluetoothDisconnected(function () {
    basic.showIcon(IconNames.No)
})

bluetooth.onUartDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    let receivedString = bluetooth.uartReadUntil(serial.delimiters(Delimiters.NewLine))

    messageHandler(receivedString)
})

type Commands = (number | number[])[]

let commandsString = ''
let commands: Commands = []
let receivingCommand = false;
let forceStop = false;

function messageHandler(receivedString: string) {
    let data = receivedString.split(';')

    if (data[0] == '<'){
        receivingCommand = true
        basic.clearScreen()
        commandsString = ''
        commands = []
        return
    } else if (data[0] == '>'){
        receivingCommand = false
        bluetooth.uartWriteString('1\n')
        return
    } else if (receivingCommand) {
        commandsString += data[0]
    } else if (data[0] == '>>') {
        forceStop = false
        if (commandsString) {
            commands = JSON.parse(commandsString)

            run(commands)
        }

    } else if (data[0] == '!') {
        forceStop = true;
        bluetooth.uartWriteString('2\n')
    }
}

function run(commands: Commands){
    for (let command of commands){
        if (forceStop) {
            break;
        }

        if (Array.isArray(command)){
            runCommand(command as number[])
        } else {
            runCommand([command as number])
        }
    }
}

pfTransmitter.connectIrSenderLed(AnalogPin.P0)

function compare(a: number, t: number, b: number){
    if (t == 1) {
        return a > b
    } else if (t == 2) {
        return a < b
    } else if (t == 3) {
        return a == b
    }

    return false
}

function runCommand(command: Commands){
    let commandNr = command[0];

    if (commandNr == 0) {
        basic.clearScreen()
    } 
    // else if (commandNr == 1){
    //     basic.pause(Math.floor(command[1] as number * 1000))
    // } 
    else if (commandNr == 2) {
        led.plot(command[1] as number, command[2] as number)
    } else if (commandNr == 3) {
        led.unplot(command[1] as number, command[2] as number)
    } else if (commandNr == 4) {
        let channel: PfChannel;

        if (command[1] == 1){
            channel = PfChannel.Channel1
        } else if (command[1] == 2) {
            channel = PfChannel.Channel2
        } else if (command[1] == 3) {
            channel = PfChannel.Channel3
        } else if (command[1] == 4) {
            channel = PfChannel.Channel4
        }

        let output: PfOutput;

        if (command[2] == 1){
            output = PfOutput.Red
        } else {
            output = PfOutput.Blue
        }

        let pfCommand: PfSingleOutput;

        if (command[3] == 0) {
            pfCommand = PfSingleOutput.Float
        } else if (command[3] == 1) {
            pfCommand = PfSingleOutput.Forward1
        } else if (command[3] == 2) {
            pfCommand = PfSingleOutput.Forward2
        } else if (command[3] == 3) {
            pfCommand = PfSingleOutput.Forward3
        } else if (command[3] == 4) {
            pfCommand = PfSingleOutput.Forward4
        } else if (command[3] == 5) {
            pfCommand = PfSingleOutput.Forward5
        } else if (command[3] == 6) {
            pfCommand = PfSingleOutput.Forward6
        } else if (command[3] == 7) {
            pfCommand = PfSingleOutput.Forward7
        } else if (command[3] == 8) {
            pfCommand = PfSingleOutput.Backward1
        } else if (command[3] == 9) {
            pfCommand = PfSingleOutput.Backward2
        } else if (command[3] == 10) {
            pfCommand = PfSingleOutput.Backward3
        } else if (command[3] == 11) {
            pfCommand = PfSingleOutput.Backward4
        } else if (command[3] == 12) {
            pfCommand = PfSingleOutput.Backward5
        } else if (command[3] == 13) {
            pfCommand = PfSingleOutput.Backward6
        } else if (command[3] == 14) {
            pfCommand = PfSingleOutput.Backward7
        } else if (command[3] == 15) {
            pfCommand = PfSingleOutput.BrakeThenFloat
        }
        
        pfTransmitter.singleOutputMode(channel, output, pfCommand)
    } 
    // else if (commandNr == 5) {
    //     let t = command[1];

    //     let f = () => {
    //         let condition = true;
    //         while (!forceStop && condition) {
    //             if (t < 3) {
    //                 condition = compare(command[2] as number, t == 1 ? input.lightLevel() : input.soundLevel(), command[3] as number)
    //             }

    //             run(command[4] as Commands)

    //             basic.pause(20)
    //         }
    //     }

    //     t == 4 ? control.runInBackground(f) : f()
    // }
    else if (commandNr == 8) {
        control.runInBackground(() => {
            let isTrue = false;

            while (!forceStop) {
                if (compare(
                    command[1] == 1 ? input.lightLevel() : input.soundLevel(), 
                    command[2] as number, 
                    command[3] as number
                )){
                    if (!isTrue){
                        isTrue = true
                        run(command[4] as Commands)
                    }
                } else {
                    isTrue = false
                }

                basic.pause(20)
            }
        })
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

    else if (commandNr == 5 || commandNr == 6) {
        let p1 = command[1] as number;
        let p2 = command[2] as number;
        let p3 = command[3] as number;
        let st = input.runningTime();
        
        let condition = true;

        while (!forceStop && condition) {
            if (p1) {
                condition = compare(
                    p1 == 1 ? (input.runningTime() - st) / 1000 : p1 == 2 ? input.lightLevel() : input.soundLevel(),
                    p2, 
                    p3
                )
            }

            if (command[4]){
                run(command[4] as Commands)
            }

            basic.pause(20)
        }
    }
    else if (commandNr == 7) {
        control.runInBackground(() => {
            run(command[1] as Commands)
        })
    }
}

// input.onButtonPressed(Button.A, function() {
//     // commands = [0, [2, 0, 0], [5, 1, 1, 10, [[2, 0, 0], [1, 1], [3, 0, 0], [1, 1]]], [2, 1, 1]] as Commands;
//     // commands = [0, [5, 2, 2, 100, [[2, 0, 0], [1, 1], [3, 0, 0], [1, 1]]], [2, 1, 1]] as Commands;
//     commands = [0, [6, 2, 2, 50], [2, 1, 1]] as Commands;
//     run(commands)
// })