export type CreateManagedUserFormState = {
  values: {
    username: string;
    displayName: string;
    role: string;
  };
  fieldErrors: {
    username?: string;
    displayName?: string;
    role?: string;
    password?: string;
    confirmPassword?: string;
    form?: string;
  };
  successMessage?: string;
};

export const initialCreateManagedUserFormState: CreateManagedUserFormState = {
  values: {
    username: "",
    displayName: "",
    role: "user",
  },
  fieldErrors: {},
};
