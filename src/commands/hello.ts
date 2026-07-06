import { Command } from "commander";

interface HelloOptions {
  upper?: boolean;
}

export function registerHelloCommand(program: Command): void {
  program
    .command("hello")
    .description("Comando de ejemplo")
    .argument("[name]", "nombre a saludar", "mundo")
    .option("-u, --upper", "mostrar en mayúsculas")
    .action((name: string, options: HelloOptions) => {
      const message = `Hola, ${name}!`;
      console.log(options.upper ? message.toUpperCase() : message);
    });
}
