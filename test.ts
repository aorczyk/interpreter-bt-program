input.onButtonPressed(Button.A, function() {
    // commands = [0, [2, 0, 0], [5, 1, 1, 10, [[2, 0, 0], [1, 1], [3, 0, 0], [1, 1]]], [2, 1, 1]] as Commands;
    // commands = [0, [5, 2, 2, 100, [[2, 0, 0], [1, 1], [3, 0, 0], [1, 1]]], [2, 1, 1]] as Commands;
    // commands = [0, [6, [[-1, 2, 20]]], [2, 1, 1]] as Commands;
    // commands = [0, [6, [[17, 2, 1]]], [2, 2, 2]] as Commands;
    commands = [[5, [[20, 2, 4, 0]], [0, [6, [[-1, 2, 10, 0]]], [102, 1, [22]], [6, [[-1, 2, 10, 0]]]]], 0, [102, 1, [44]]] as Commands;
    run(commands)
})