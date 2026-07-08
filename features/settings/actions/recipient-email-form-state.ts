export type RecipientEmailFormState = {
  values: {
    reminderEmail: string;
  };
  fieldErrors: {
    reminderEmail?: string;
    form?: string;
  };
  successMessage?: string;
};

export const initialRecipientEmailFormState: RecipientEmailFormState = {
  values: {
    reminderEmail: "",
  },
  fieldErrors: {},
};
