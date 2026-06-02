import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PaymentsService } from '../src/payments/payments.service';

function parseArgNumber(flag: string): number | undefined {
  const arg = process.argv.find((value) => value.startsWith(`${flag}=`));
  if (!arg) return undefined;
  const value = Number(arg.slice(flag.length + 1));
  return Number.isFinite(value) ? value : undefined;
}

async function run() {
  const now = new Date();
  const month = parseArgNumber('--month') ?? now.getUTCMonth() + 1;
  const year = parseArgNumber('--year') ?? now.getUTCFullYear();
  const isConfirm = process.argv.includes('--confirm');
  const dryRun = !isConfirm;
  const branchId = process.argv
    .find((value) => value.startsWith('--branchId='))
    ?.split('=')[1];
  const courseId = process.argv
    .find((value) => value.startsWith('--courseId='))
    ?.split('=')[1];
  const studentId = process.argv
    .find((value) => value.startsWith('--studentId='))
    ?.split('=')[1];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const paymentsService = app.get(PaymentsService);
    const result = await paymentsService.generateMonthlyPayments({
      year,
      month,
      dryRun,
      branchId,
      courseId,
      studentId,
    });

    console.log(JSON.stringify(result, null, 2));
    if (dryRun) {
      console.log('Dry-run mode. Re-run with --confirm to create payments.');
    }
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
