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
let allStoped: number[] = []

function messageHandler(receivedString: string) {
    // basic.pause(1000)
    // bluetooth.uartWriteString(receivedString + '\n')
    // return
    let data = receivedString.split(';')

    if (data[0] == '<'){
        receivingCommand = true
        basic.clearScreen()
        basic.showString("T")
        // led.plot(4, 0)
        commandsString = ''
        commands = []
        return
    } else if (data[0] == '>'){
        receivingCommand = false
        allStoped.push(1)
        // led.unplot(4, 0)
        basic.showIcon(IconNames.Yes)
        // basic.pause(500)
        bluetooth.uartWriteString("1" + '\n')
        // music.playTone(Note.C, music.beat())
        return
    } else if (receivingCommand) {
        commandsString += data[0]
    } else if (data[0] == '>>') {
        forceStop = false
        try {
            if (commandsString) {
                commands = JSON.parse(commandsString)
                // console.log(commands[1])

                run(commands)
            }
        } catch (err) {
            bluetooth.uartWriteString(err.message)
        }
    } else if (data[0] == '!') {
        forceStop = true;
        bluetooth.uartWriteString("2" + '\n')
    }
}

function confirmStop() {
    allStoped.shift()
    if (allStoped.length == 0){
        bluetooth.uartWriteString("2" + '\n')
    }
}

function run(commands: Commands){
    for (let command of commands){
        // console.log(command)

        if (Array.isArray(command)){
            runCommand(command as number[])
        } else {
            runCommand([command as number])
        }

        if (forceStop){
            confirmStop()
            break;
        }
    }
}

pfTransmitter.connectIrSenderLed(AnalogPin.P0)

const pfChannels: {[key: number]: PfChannel} = {
    1: PfChannel.Channel1,
    2: PfChannel.Channel2,
    3: PfChannel.Channel3,
    4: PfChannel.Channel4,
}

const pfOutputs: { [key: number]: PfOutput } = {
    1: PfOutput.Red,
    2: PfOutput.Blue,
}

const pfSingleOutput: { [key: number]: PfSingleOutput } = {
    0: PfSingleOutput.Float,
    1: PfSingleOutput.Forward1,
    2: PfSingleOutput.Forward2,
    3: PfSingleOutput.Forward3,
    4: PfSingleOutput.Forward4,
    5: PfSingleOutput.Forward5,
    6: PfSingleOutput.Forward6,
    7: PfSingleOutput.Forward7,
    8: PfSingleOutput.Backward1,
    9: PfSingleOutput.Backward2,
    10: PfSingleOutput.Backward3,
    11: PfSingleOutput.Backward4,
    12: PfSingleOutput.Backward5,
    13: PfSingleOutput.Backward6,
    14: PfSingleOutput.Backward7,
    15: PfSingleOutput.BrakeThenFloat
}

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

// let lightLevel = 0;

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
        pfTransmitter.singleOutputMode(pfChannels[command[1] as number], pfOutputs[command[2] as number], pfSingleOutput[command[3] as number])
    } 
    // else if (commandNr == 5) {
    //     control.runInBackground(() => {
    //         while (true) {
    //             let data = [input.runningTime(), input.compassHeading()];

    //             bluetooth.uartWriteString(data.join(',') + '\n')

    //             basic.pause(command[2] as number || 20)
    //         }
    //     })
    // }
    else if (commandNr == 6) {
        // let out = input.lightLevel();
        control.runInBackground(() => {
            allStoped.push(1)
            let isTrue = false;
            
            while (!forceStop) {
                let test = compare(command[1] as number, input.lightLevel(), command[2] as number)

                if (test){
                    if (!isTrue){
                        isTrue = true
                        run(command[3] as Commands)
                    }
                } else {
                    isTrue = false
                }

                basic.pause(20)
            }

            confirmStop()
        })
    }
}

// basic.forever(() =>{
//     lightLevel = input.lightLevel();
// })
