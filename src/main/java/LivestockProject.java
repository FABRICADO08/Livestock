/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

/**
 *
 * @author 202002208
 */
import java.util.Scanner;
public class LivestockProject {
     private static int memb_num,month,day=0,year,daycount=0,members=0;
    private static int bull =0;
    private static int heifer =0;
    private static int stock = bull + heifer;
    private static String memb_name,memb_surname,memb_gender,memb_loc,DatOfBrth;
    
    public LivestockProject(int memb_num, String memb_name, String memb_surname, String DatOfBrth, String memb_gender, String memb_loc,int Bull, int Heifer,int Month,int Year,int DayCount,int Day){
        
        this.memb_num = memb_num;
        this.memb_name = memb_name;
        this.memb_surname= memb_surname;
        this.DatOfBrth = DatOfBrth;
        this.memb_gender = memb_gender;
        this.memb_loc = memb_loc;
        this.stock = stock;
        this.bull=Bull;
        this.heifer=Heifer;
        this.month = Month;
        this.year = Year;
        this.daycount= DayCount;
        this.day=Day;
        
    }
    
     public void getProduct(){
          System.out.println("Production estimation for other members");
                
             PredictProduction predicts = new PredictProduction();
               predicts.Product();  
               
     }
    
    
     public void setEstimation(int heifer){
        
          this.heifer = heifer;
          
          
          int expectedcalves =0,totalcalves=0,totalbullcalves=0,totalheifercalves=0,birth=0,members=0;
          int month=0,year=0,daycount=0,bulldaybirth,heiferdaybirth,day=0;
          this.month=month;
          this.year =year;
          this.daycount=daycount;
          this.day =day;
          this.members=members;
          while(heifer>0 && birth<8 ){
               
              
          expectedcalves = (int)(heifer * (0.9*0.9*0.95));
          
          int bullcalves = (int)(expectedcalves * 0.3);
         
          int heifercalves = expectedcalves - bullcalves;
          
          heifer-= expectedcalves;
          
          System.out.println( "After 21 days we expect " + expectedcalves + " cow(s) will be under gestation, " + bullcalves + " of them will carry bull(s) and "+ heifercalves + " of them will carry heifer(s)" );
          
           
          System.out.println("Cow(s) left for breeding after the last 21 days = " + heifer);
         
          if(daycount%279==0){
              System.out.println("Good news our cow(s) have given birth to "+heifercalves+" heifer calve(s) and will be in involution for 50 days");
           birth++;
             totalheifercalves+=heifercalves;
              for( heiferdaybirth=0;heiferdaybirth<=50;heiferdaybirth ++){
              if(heiferdaybirth==50){
                  
               expectedcalves=(int)(heifercalves*(0.9*0.9*0.95));
                totalcalves+=expectedcalves;
               heifer-=expectedcalves;
               heifercalves=(int)(expectedcalves*(0.7));
               
               bullcalves=(int)(expectedcalves*(0.3));
               totalbullcalves+=bullcalves;
               
               
                System.out.println("Now we expect "+expectedcalves+" more calves from the cows that gave birth to heifers 50 days ago "+bullcalves+" of them will be bull(s) and "+heifercalves+" will be heifer(s)");
              birth++;
              }}
               }
              
               if(daycount%287==0){
              System.out.println("Good news our cow(s) have given birth to "+bullcalves+" bull calve(s) and will be in involution for 50 days");
              totalbullcalves+=bullcalves;
              bull+=bullcalves;
              for(  bulldaybirth=0;bulldaybirth<=50;bulldaybirth++){
              if(bulldaybirth==50){
                  
                  expectedcalves= (int)(bullcalves *(0.9*0.9*0.95));
                   
                  bullcalves+=(int)( expectedcalves*(0.3));
                  
                  
                  heifercalves+=(int)(expectedcalves *(0.7));
                  
                  System.out.println("And now we again expect more calves from the cow(s) that gave birth to bull(s) 50 days ago");
                  System.out.println("They will have "+ heifercalves + "  heifercalve(s) and " + bullcalves + "  bullcalve(s)");
              heifer+=totalheifercalves;
              }
            }
             
             
          }
               int total_calves=totalcalves;
               int total_bulls = bull;
               int total_heifers = totalheifercalves;
         if(day%365==0 || day%366==0 ){
             
                 month+=1;
                year++;
                System.out.println("After year : "+ year);
                System.out.println("we produced : "+(totalbullcalves+totalheifercalves) + " calves and we have   "+ bull+" bull(s) and "+totalheifercalves+ " heifer(s)");
                total_calves+=(totalbullcalves+totalheifercalves);
                total_bulls +=totalbullcalves;
                total_heifers+=totalheifercalves;
                System.out.println("The total livestock production for the entire project = " +total_calves);
                System.out.println("Total bulls produced by : " +this.memb_name + " = "+ bull);
                System.out.println("Total heifers produced by : "+this.memb_name  + " = "+totalheifercalves);
                
            }
              
              System.out.println(" ");
            
            if(birth==8){
               getProduct();
                System.out.println("The total livestock production for the entire project = " + total_calves);
                System.out.println("The total Bulls production for the entire project = " + total_bulls);
                System.out.println("The total heifers production for the entire project = " + total_heifers);
                System.exit(0);
            }
            
          }
          
          
              
            }
     //set and get for month
     public void setMonth(int month){
         this.month =month;
     }
     public int getMonth(int month){
         return month;
     }
     
     //set and get for year
     public void setYear(int Year){
         this.year = Year;
     }
     
     public int getYear(int Year){
         return Year;
     }
     
     //set and get for day count
     public void setDayc(int DayCount){
         this.daycount = DayCount;
     }
     
     public int getDayc(int DayCount){
         return DayCount;
     }
    
    //set and get Methods for member number
   public void setNum( int memb_num){
       this.memb_num = memb_num;
   }
   
     public int getNum( int m_num){
       return m_num;
   }
     
     //set and get Methods for the member's name
     
     public void setName( String memb_name){
       this.memb_name = memb_name;
   }
   
     public String getName( String memb_name){
       return memb_name;
   }
     
     //set and get Methods for the member surname
      public void setSurname( String memb_surname){
       this.memb_surname = memb_surname;
   }
   
     public String getSurname( String memb_surname){
       return memb_surname;
   }
     
     //set and get Methods for a member date of birth
      public void setDatOfBrth( String DatofBrth){
       this.DatOfBrth = DatofBrth;
   }
   
     public String getDatOfBrth( String DatOfBrth){
       return DatOfBrth;
   }
     
     //set and get Methods for member gender
     
     public void setGender( String m_gender){
       this.memb_gender = m_gender;
   }
   
     public String getGender( String m_gender){
       return m_gender;
   }
     
     //set and get Methods for member name
     
     public void setLocation( String m_location){
       this.memb_loc = m_location;
   }
   
     public String getLocation( String m_location){
       return m_location;
   }
     
      //set and get Methods for stock
      public void setBull( int bull){
       this.bull = bull;
   }
 
     public int getBull( int bull){
       return bull;
   }
     
     public void setHeifer( int heifer){
       this.heifer = heifer;
   }
     public void setStock(int bull,int heifer){
         this.bull = bull;
         this.heifer = heifer;
         this.stock = bull + heifer;
     }
     
     public int getStock(int stock){
         return stock;
     }
   
     public int getHeifer( int heifer){
       return heifer;
   }
     
     
     
    public static void main(String[] args) {
        
        int membnum;
        int cattlebull=0;
        int cattleheifer=0;
        String name,surname,gender,location,date;
        
        Scanner inputint = new Scanner(System.in);
        Scanner inputstr = new Scanner(System.in);
        
        System.out.println("ENTER MEMBERSHIP NUMBER : ");
        membnum = inputint.nextInt();
        
        
        System.out.println("ENTER MEMBER'S FIRST NAME : ");
        name = inputstr.nextLine();
        
       System.out.println("ENTER MEMBER'S SURNAME : ");
        surname = inputstr.nextLine();
        
        System.out.println("ENTER MEMBER'S DATE OF BIRTH : ");
        date = inputstr.nextLine();
        
        System.out.println("Enter member's gender");
        gender = inputstr.nextLine();
        
        System.out.println("Enter member's location");
        location = inputstr.nextLine();
        
        System.out.println("Enter initial number of bull(s) and  cow(s) respectively \n"+"Following the ratio of 2bulls/100cows for a period of 5years ");
        cattlebull = inputint.nextInt();
        cattleheifer= inputint.nextInt();
        
        int initial_num = cattlebull + cattleheifer;
         int year=0,day=0,month=0,calves =0,expectedcalves =0, bullcalves =0,heifercalves = 0,daycount=0, yearcount=0;
        int totalcalves=0,totalheifer=0,totalcalvebull=0,totalbull=0,totalcow=0;
        LivestockProject livestockProject = new LivestockProject(membnum,name,surname,date,gender,location,cattlebull,cattleheifer,month,year,daycount,day);
        
        System.out.println("Membership number : " +livestockProject.getNum(membnum)+"\n"+"Member's name : " +livestockProject.getName(name)+"\n"+"Member's surname : "+livestockProject.getSurname(surname)+"\n"+"Member's date of birth : "+livestockProject.getDatOfBrth(date)+"\n"+"Member's gender : "+livestockProject.getGender(gender)+"\n"+"Member's Location : "+livestockProject.getLocation(location)+"\n"+"Initial number of cattle : "+livestockProject.getStock(initial_num));
        
        
        //production
       
        System.out.println(" ");
        System.out.println("Enter your initial year");
        Scanner inputP = new Scanner(System.in);
        year = inputP.nextInt();
       
        
        Production production = new Production(year,day);
        livestockProject.setEstimation(cattleheifer);
        do{
           
            while( bull > 0 && heifer>0){
            for(day = 1; day<=daycount;day++){
                if(day==21){ 
              livestockProject.setEstimation(cattleheifer);
               
             }
             
            daycount++;
            livestockProject.setDayc(daycount);
           
            }
          }   
        }while(daycount<3000);
        
      
    }

}
