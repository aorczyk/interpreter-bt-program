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
        // basic.showIcon(IconNames.Happy)
        bluetooth.uartWriteString("1" + '\n')
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
    }
}

function run(commands: Commands){
    for (let command of commands){

        if (Array.isArray(command)){
            runCommand(command as number[])
        } else {
            runCommand([command as number])
        }

        if (forceStop){
            // confirmStop()
            break;
        }
    }
}

pfTransmitter.connectIrSenderLed(AnalogPin.P0)

// const pfChannels: {[key: number]: PfChannel} = {
//     1: PfChannel.Channel1,
//     2: PfChannel.Channel2,
//     3: PfChannel.Channel3,
//     4: PfChannel.Channel4
// }

// const pfOutputs: { [key: number]: PfOutput } = {
//     1: PfOutput.Red,
//     2: PfOutput.Blue,
// }

// const pfSingleOutput: { [key: number]: PfSingleOutput } = {
//     0: PfSingleOutput.Float,
//     1: PfSingleOutput.Forward1,
//     2: PfSingleOutput.Forward2,
//     3: PfSingleOutput.Forward3,
//     4: PfSingleOutput.Forward4,
//     5: PfSingleOutput.Forward5,
//     6: PfSingleOutput.Forward6,
//     7: PfSingleOutput.Forward7,
//     8: PfSingleOutput.Backward1,
//     9: PfSingleOutput.Backward2,
//     10: PfSingleOutput.Backward3,
//     11: PfSingleOutput.Backward4,
//     12: PfSingleOutput.Backward5,
//     13: PfSingleOutput.Backward6,
//     14: PfSingleOutput.Backward7,
//     15: PfSingleOutput.BrakeThenFloat
// }

function compare(n: number, a: number, b: number){
    if (n == 1) {
        return a > b
    } else if (n == 2) {
        return a < b
    } else if (n == 3) {
        return a == b
    }

    return false
}

function runCommand(command: Commands){
    let commandNr = command[0];

    if (commandNr == 0) {
        basic.clearScreen()
    } else if (commandNr == 1){
        basic.pause(Math.floor(command[1] as number * 1000))
    } else if (commandNr == 2) {
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
    else if (commandNr == 5) {
        let t = command[1];

        let f = () => {
            let condition = true;
            while (!forceStop && condition) {
                let light = input.lightLevel();
                let sound = input.soundLevel();

                if (t < 3) {
                    condition = compare(command[2] as number, t == 1 ? light : sound, command[3] as number)
                }

                run(command[4] as Commands)
            }
        }

        t == 4 ? control.runInBackground(f) : f()
    }
    else if (commandNr == 6) {
        // let out = input.lightLevel();
        control.runInBackground(() => {
            let isTrue = false;
            
            while (!forceStop) {
                let light = input.lightLevel();
                let sound = input.soundLevel();

                let test = compare(command[2] as number, command[1] == 1 ? light : sound, command[3] as number)

                if (test){
                    if (!isTrue){
                        isTrue = true
                        run(command[4] as Commands)
                    }
                } else {
                    isTrue = false
                }

                basic.pause(20)
            }

            // confirmStop()
        })
    }
}
