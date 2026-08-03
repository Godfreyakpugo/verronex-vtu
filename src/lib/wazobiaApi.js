import supabase from "./supabaseClient";

async function invoke(endpoint, payload) {
  const { data, error } = await supabase.functions.invoke("vtu-api", {
    body: {
      endpoint,
      payload,
    },
  });

  if (error) throw error;

  if (data.error) {
    throw new Error(data.error);
  }

  return data;
}

export const airtimeAPI = {
  purchase(payload) {
    return invoke("airtime", payload);
  },
};

export const dataAPI = {
  purchase(payload) {
    return invoke("data", payload);
  },
};