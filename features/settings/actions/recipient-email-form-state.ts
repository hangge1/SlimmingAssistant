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

export type RecipientEmailTestFormState = {
  fieldErrors: {
    reminderEmail?: string;
    form?: string;
  };
  successMessage?: string;
};

export const initialRecipientEmailTestFormState: RecipientEmailTestFormState = {
  fieldErrors: {},
};
