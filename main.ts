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

input.onButtonPressed(Button.A, function() {
    messageHandler('<')
    messageHandler('[0,[2,1,1],[1,1000],[3,1,1]]')
    messageHandler('>')
})

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
        f1 = function () {}
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
            break;
        }
    }

    bluetooth.uartWriteString("2" + '\n')
}

let f1 = function() {}

basic.forever(function() {
    f1()
})

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

function sensorDataByNr(n: number){
    if (n == 1){
        return input.temperature()
    } else if (n == 2) {
        return input.lightLevel()
    }

    return null
}

function compare(n: number, a: number, b: number){
    if (n == 1) {
        return a > b
    } else if (n == 2) {
        return a < b
    } else if (n == 3) {
        return a == b
    }

    return null
}

function runCommand(command: Commands){
    let commandNr = command[0];

    switch (commandNr) {
        case 0:
            basic.clearScreen()
            break;
        case 1:
            basic.pause(Math.floor(command[1] as number *1000))
            break;
        case 2:
            led.plot(command[1] as number, command[2] as number)
            break;
        case 3:
            led.unplot(command[1] as number, command[2] as number)
            break;
        case 4:
            pfTransmitter.singleOutputMode(pfChannels[command[1] as number], pfOutputs[command[2] as number], pfSingleOutput[command[3] as number])
            break;
        case 5:
            f1 = function() {
                let data = [input.runningTime(), sensorDataByNr(command[1] as number)];

                bluetooth.uartWriteString(data.join(',') + '\n')

                basic.pause(command[2] as number)
            }
            break;
        case 6:
            let test = compare(command[2] as number, sensorDataByNr(command[1] as number), command[3] as number)

            if (test){
                run(command[4] as number[])
            }
            break;
        default:
            break;
    }
}
