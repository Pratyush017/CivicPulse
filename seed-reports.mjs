import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://cpcmkcjddqpkhjhvugto.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwY21rY2pkZHFwa2hqaHZ1Z3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNjk0ODEsImV4cCI6MjA5Nzk0NTQ4MX0._uYIYqgVffk0QvBZpSFf6PQ1rO6Ik5kTiCtcMBli424"
);

const dummyReports = [
  {
    title: "Large Pothole on MG Road",
    description:
      "A deep pothole approximately 2 feet wide near the MG Road metro station exit. Multiple vehicles have been damaged. Immediate repair needed before monsoon worsens it.",
    category: "Pothole",
    severity_score: 4,
    latitude: 12.9716,
    longitude: 77.5946,
    image_url:
      "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400&h=300&fit=crop",
    status: "Reported",
  },
  {
    title: "Broken Streetlight on Park Street",
    description:
      "Streetlight has been non-functional for over 2 weeks near Park Street crossing. The area becomes dangerously dark after 7 PM, creating safety concerns for pedestrians.",
    category: "Broken Streetlight",
    severity_score: 3,
    latitude: 22.5726,
    longitude: 88.3639,
    image_url:
      "https://images.unsplash.com/photo-1542621334-a254cf47733d?w=400&h=300&fit=crop",
    status: "In Progress",
  },
  {
    title: "Illegal Garbage Dumping near Juhu Beach",
    description:
      "Large amounts of construction debris and household waste dumped illegally near the Juhu Beach promenade. Foul smell affecting nearby residents and beachgoers.",
    category: "Illegal Dumping",
    severity_score: 5,
    latitude: 19.0988,
    longitude: 72.8267,
    image_url:
      "https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=400&h=300&fit=crop",
    status: "Reported",
  },
  {
    title: "Water Pipe Leak on Anna Salai",
    description:
      "A municipal water pipe is leaking continuously near Anna Salai junction, causing water wastage and slippery road conditions. Minor flooding on the sidewalk.",
    category: "Water Leak",
    severity_score: 2,
    latitude: 13.0604,
    longitude: 80.2496,
    image_url:
      "https://images.unsplash.com/photo-1504973960431-1c467e159aa4?w=400&h=300&fit=crop",
    status: "Reported",
  },
  {
    title: "Fallen Tree Blocking Road in Connaught Place",
    description:
      "A large neem tree has fallen across the road after last night's storm near Connaught Place inner circle. Completely blocking one lane of traffic and damaging a parked car.",
    category: "Fallen Tree",
    severity_score: 5,
    latitude: 28.6315,
    longitude: 77.2167,
    image_url:
      "https://images.unsplash.com/photo-1542856391-010fb87dcfed?w=400&h=300&fit=crop",
    status: "Reported",
  },
];

async function seed() {
  console.log("Inserting 5 dummy reports...\n");

  const { data, error } = await supabase
    .from("reports")
    .insert(dummyReports)
    .select();

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(`✅ Inserted ${data.length} reports:\n`);
  for (const r of data) {
    console.log(`  • [${r.severity_score}/5] ${r.title} — (${r.latitude}, ${r.longitude})`);
  }
}

seed();
