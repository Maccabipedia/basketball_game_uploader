interface FormPayload {
    [key: string]: any;
}

const formData: FormPayload = JSON.parse(process.env.FORM_DATA || "{}");

console.log("Received form payload:");
console.log(formData);
