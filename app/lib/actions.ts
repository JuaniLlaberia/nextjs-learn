'use server';

import { signIn } from '@/auth';
import { sql } from '@vercel/postgres';
import { error } from 'console';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

//Validation schemas
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce.number().gt(0, {
    message: 'Please enter a value greater than $0',
  }),
  status: z.enum(['paid', 'pending'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

//This fields will be created by the database
const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// This is temporary until @types/react-dom is updated
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

//Actions
export const authenticate = async (
  prevState: string | undefined,
  formData: FormData,
) => {
  try {
    await signIn('credentials', formData);
    redirect('/dashboard');
  } catch (err) {
    if (err instanceof Error) {
      switch (err.cause) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
      }
    }
    throw err;
  }
};

export const createInvoice = async (prevState: State, formData: FormData) => {
  // const rawFormData = Object.fromEntries(formData.entries());

  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success)
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice',
    };

  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
      `;

    revalidatePath('/dashboard/invoices');
  } catch (err) {
    return {
      message: 'Database Error: Failed to Create Invoice',
    };
  }

  redirect('/dashboard/invoices');
};

export const updateInvoice = async (
  id: string,
  prevState: State,
  formData: FormData,
) => {
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success)
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice',
    };

  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;

  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;

    revalidatePath('/dashboard/invoices');
  } catch (err) {
    return {
      message: 'Database Error: Failed to Create Invoice',
    };
  }

  redirect('/dashboard/invoices');
};

export const deleteInvoice = async (id: string) => {
  try {
    await sql`
        DELETE FROM invoices WHERE id = ${id}`;

    revalidatePath('/dashboard/invoices');
  } catch (err) {}
};
